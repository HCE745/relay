import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { format, formatDistanceToNowStrict } from "date-fns"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { OrgActions } from "./org-actions"
import { UserTable } from "./user-table"
import { OrgNotes } from "./org-notes"
import { OrgPricing } from "./org-pricing"
import { OrgDiagnostics } from "@/components/super-admin/org-diagnostics"
import { OrgFeatureFlagsPanel } from "./feature-flags"
import { OrgWCFlagsPanel } from "./wc-feature-flags"
import { ALL_WC_FLAGS, type OrgWCFlags } from "@/lib/workforce-comms"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"
import { CrmLifecycleSelector } from "@/components/super-admin/crm-lifecycle-selector"
import { CrmNotes } from "@/components/super-admin/crm-notes"
import { CrmActivityTimeline } from "@/components/super-admin/crm-activity-timeline"
import { CrmNonConversionForm } from "@/components/super-admin/crm-non-conversion-form"
import { BillingCreditsSection } from "./billing-credits-section"
import { BillingTimeline } from "./billing-timeline"

export const dynamic = "force-dynamic"

const PLAN_LABEL: Record<string, string> = {
  free: "Free", essentials: "Essentials", starter: "Starter",
  professional: "Professional", pro: "Pro", enterprise: "Enterprise",
}
const STATUS_LABEL: Record<string, string> = {
  active: "Active", trialing: "Trial", expired: "Expired",
  past_due: "Past Due", canceled: "Canceled", suspended: "Suspended",
}
const STATUS_COLOR: Record<string, string> = {
  active:    "bg-green-900/60 text-green-300 border-green-800",
  trialing:  "bg-amber-900/60 text-amber-300 border-amber-800",
  past_due:  "bg-orange-900/60 text-orange-300 border-orange-800",
  canceled:  "bg-gray-800 text-gray-500 border-gray-700",
  suspended: "bg-red-950/80 text-red-400 border-red-900",
  expired:   "bg-red-900/60 text-red-400 border-red-800",
}

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }  = await params
  const { tab } = await searchParams
  const activeTab = tab === "diagnostics" ? "diagnostics" : "overview"

  const [org, notes, adminAcceptance, usersWithoutAcceptance, crmNotes, crmActivities, nonConversionReasons, billingCredits, referral] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, issues: true, assets: true, suggestions: true, locations: true, departments: true, routingRules: true },
        },
        users: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
        },
      },
    }),
    prisma.orgNote.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.legalAcceptance.findFirst({
      where:   { organizationId: id, user: { role: "ADMIN" } },
      orderBy: { acceptedAt: "desc" },
      select:  { termsVersion: true, privacyVersion: true, acceptedAt: true, ipAddress: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId: id,
        isActive:        true,
        legalAcceptances: {
          none: {
            termsVersion:   CURRENT_TERMS_VERSION,
            privacyVersion: CURRENT_PRIVACY_VERSION,
          },
        },
      },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.crmNote.findMany({
      where:   { organizationId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.crmActivity.findMany({
      where:   { organizationId: id },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    prisma.nonConversionReason.findMany({
      where:   { organizationId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.billingCredit.findMany({
      where:   { orgId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.findFirst({
      where: { OR: [{ referrerOrgId: id }, { referredOrgId: id }] },
    }),
  ])

  if (!org) notFound()

  const adminUser   = org.users.find((u) => u.role === "ADMIN")
  const activeCount = org.users.filter((u) => u.isActive).length
  const lastLogin   = org.users
    .map((u) => u.lastLoginAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]

  // Health score breakdown
  const now2 = Date.now()
  const daysSinceLogin = lastLogin ? (now2 - new Date(lastLogin).getTime()) / 86_400_000 : Infinity
  const loginPts    = daysSinceLogin <= 7 ? 25 : daysSinceLogin <= 30 ? 15 : daysSinceLogin <= 90 ? 5 : 0
  const issuePts    = org._count.issues > 10 ? 25 : org._count.issues > 5 ? 15 : org._count.issues > 0 ? 5 : 0
  const userPts     = org._count.users > 10 ? 20 : org._count.users > 5 ? 12 : org._count.users > 1 ? 5 : 0
  const routingPts  = org._count.routingRules > 0 ? 15 : 0
  const subPts      = org.subscriptionStatus === "active" ? 15 : org.subscriptionStatus === "trialing" ? 5 : 0
  const healthScore = Math.min(loginPts + issuePts + userPts + routingPts + subPts, 100)
  const healthColor = healthScore >= 80 ? "text-green-400" : healthScore >= 50 ? "text-yellow-400" : healthScore >= 25 ? "text-orange-400" : "text-red-400"

  const now = new Date()
  const trialExpired = org.trialEndsAt && org.trialEndsAt < now
  const displayStatus =
    org.suspendedAt          ? "suspended"
    : org.subscriptionStatus === "active"   ? "active"
    : org.subscriptionStatus === "past_due" ? "past_due"
    : org.subscriptionStatus === "canceled" ? "canceled"
    : trialExpired            ? "expired"
    : "trialing"

  const orgData = {
    id:                     org.id,
    name:                   org.name,
    slug:                   org.slug,
    plan:                   org.plan,
    subscriptionStatus:     org.subscriptionStatus,
    suspendedAt:            org.suspendedAt?.toISOString() ?? null,
    trialEndsAt:            org.trialEndsAt?.toISOString() ?? null,
    stripeCustomerId:       org.stripeCustomerId    ?? null,
    stripeSubscriptionId:   org.stripeSubscriptionId ?? null,
    employeeLimit:          org.employeeLimit  ?? null,
    locationLimit:          org.locationLimit  ?? null,
    onboardingCompleted:    !!org.onboardingCompletedAt,
    aiSuggestionsAvailable: org.aiSuggestionsAvailable,
  }

  const pricingData = {
    orgId:               org.id,
    plan:                org.plan,
    subscriptionStatus:  org.subscriptionStatus,
    billingFrequency:    org.billingFrequency,
    currentPrice:        org.currentPrice ?? null,
    priceLockedUntil:    org.priceLockedUntil?.toISOString() ?? null,
    intelligenceModules: org.intelligenceModules,
    intelligenceSuiteEnabled: org.intelligenceSuiteEnabled ?? false,
    companySize:         org.companySize ?? null,
    numberOfLocations:   org.numberOfLocations ?? null,
    employeeCount:       org.employeeLimit  ?? null,
    locationCount:       org.locationLimit  ?? null,
    stripeCustomerId:    org.stripeCustomerId    ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    // Calculated pricing
    monthlyBasePrice:           org.monthlyBasePrice           ?? null,
    monthlyScalingCost:         org.monthlyScalingCost         ?? null,
    monthlyModulesCost:         org.monthlyModulesCost         ?? null,
    monthlyTotalBeforeDiscount: org.monthlyTotalBeforeDiscount ?? null,
    monthlyTotalAfterDiscount:  org.monthlyTotalAfterDiscount  ?? null,
    // Discount
    discountPercent:   org.discountPercent   ?? null,
    discountExpiresAt: org.discountExpiresAt?.toISOString() ?? null,
    discountLabel:     org.discountLabel     ?? null,
    // Checkout intent
    checkoutIntentStatus: org.checkoutIntentStatus ?? null,
  }

  const tabLink = (t: string) =>
    `/super-admin/organizations/${id}?tab=${t}`

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/super-admin/organizations" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to customers
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLOR[displayStatus]}`}>
                {STATUS_LABEL[displayStatus]}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">{org.slug} · {PLAN_LABEL[org.plan] ?? org.plan} plan</p>
            <div className="mt-2">
              <CrmLifecycleSelector orgId={org.id} currentStatus={org.lifecycleStatus} />
            </div>
          </div>
          <OrgActions org={orgData} adminUserId={adminUser?.id ?? null} adminUserName={adminUser?.name ?? null} />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {(["overview", "diagnostics"] as const).map((t) => (
          <Link
            key={t}
            href={tabLink(t)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === t
                ? "bg-gray-800 text-white border-b-2 border-indigo-500"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <>
          {/* Info cards */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            {/* Org info */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Organization</h2>
              <dl className="space-y-2">
                {([
                  ["Industry",    org.industry     ?? "—"],
                  ["Size",        org.companySize   ?? "—"],
                  ["Created",     format(new Date(org.createdAt), "MMM d, yyyy")],
                  ["Onboarding",  org.onboardingCompletedAt ? "Complete" : "Incomplete"],
                  ["Suspended",   org.suspendedAt ? format(new Date(org.suspendedAt), "MMM d") : "No"],
                  ["AI Suggestions", org.aiSuggestionsAvailable ? "Enabled" : "Disabled"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500 text-xs shrink-0">{k}</dt>
                    <dd className="text-gray-300 text-xs text-right truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Subscription */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Subscription</h2>
              <dl className="space-y-2">
                {([
                  ["Plan",         PLAN_LABEL[org.plan] ?? org.plan],
                  ["Status",       STATUS_LABEL[displayStatus]],
                  ["Trial ends",   org.trialEndsAt ? format(new Date(org.trialEndsAt), "MMM d, yyyy") : "—"],
                  ["Stripe Cust.", org.stripeCustomerId    ?? "—"],
                  ["Stripe Sub.",  org.stripeSubscriptionId ?? "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500 text-xs shrink-0">{k}</dt>
                    <dd className="text-gray-300 text-xs text-right truncate font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Admin & activity */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Owner / Activity</h2>
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 text-xs shrink-0">Admin</dt>
                  <dd className="text-gray-300 text-xs text-right truncate">{adminUser?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 text-xs shrink-0">Email</dt>
                  <dd className="text-gray-300 text-xs text-right truncate">{adminUser?.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 text-xs shrink-0">Last login</dt>
                  <dd className="text-gray-300 text-xs text-right">
                    {lastLogin ? formatDistanceToNowStrict(new Date(lastLogin), { addSuffix: true }) : "Never"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 text-xs shrink-0">Active users</dt>
                  <dd className="text-green-400 text-xs font-semibold">{activeCount} / {org.users.length}</dd>
                </div>
                {([
                  ["Emp. limit",  org.employeeLimit != null ? String(org.employeeLimit) : "Unlimited"],
                  ["Loc. limit",  org.locationLimit != null ? String(org.locationLimit) : "Unlimited"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500 text-xs shrink-0">{k}</dt>
                    <dd className="text-gray-300 text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Usage */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Usage</h2>
              <dl className="space-y-2">
                {([
                  ["Users",       org._count.users],
                  ["Issues",      org._count.issues],
                  ["Assets",      org._count.assets],
                  ["Suggestions", org._count.suggestions],
                  ["Locations",   org._count.locations],
                  ["Departments", org._count.departments],
                ] as [string, number][]).map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between">
                    <dt className="text-gray-500 text-xs">{k}</dt>
                    <dd className="text-white font-semibold text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Health Score */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Health Score</h2>
              <span className={`text-3xl font-bold ${healthColor}`}>{healthScore}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-yellow-500" : healthScore >= 25 ? "bg-orange-500" : "bg-red-500"}`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <dl className="space-y-1.5">
              {([
                ["Recent login",         loginPts,   25, daysSinceLogin === Infinity ? "Never" : `${Math.round(daysSinceLogin)}d ago`],
                ["Issues submitted",     issuePts,   25, `${org._count.issues} issues`],
                ["Team members",         userPts,    20, `${org._count.users} users`],
                ["Routing rules",        routingPts, 15, `${org._count.routingRules} rules`],
                ["Active subscription",  subPts,     15, org.subscriptionStatus],
              ] as [string, number, number, string][]).map(([label, pts, max, detail]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{detail}</span>
                    <span className={pts > 0 ? "text-green-400 font-semibold" : "text-gray-700"}>
                      +{pts}/{max}
                    </span>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Subscription & Pricing */}
          <div className="mb-6">
            <OrgPricing pricing={pricingData} />
          </div>

          {/* Professional Plus Feature Flags */}
          <div className="mb-6">
            <OrgFeatureFlagsPanel
              orgId={org.id}
              flags={{
                regions_enabled:                   org.regions_enabled,
                corporate_dashboard_enabled:        org.corporate_dashboard_enabled,
                cross_location_analytics_enabled:   org.cross_location_analytics_enabled,
                advanced_escalations_enabled:       org.advanced_escalations_enabled,
                api_webhooks_enabled:               org.api_webhooks_enabled,
                sso_foundation_enabled:             org.sso_foundation_enabled,
                shared_facility_enabled:            org.shared_facility_enabled,
                qr_codes_enabled:                  org.qr_codes_enabled,
                external_collaborators_enabled:     org.external_collaborators_enabled,
                multi_org_enabled:                  org.multi_org_enabled,
                executive_briefings_enabled:        org.executive_briefings_enabled,
                health_scores_enabled:              org.health_scores_enabled,
                trend_detection_enabled:            org.trend_detection_enabled,
                executive_goals_enabled:            org.executive_goals_enabled,
              }}
            />
          </div>

          {/* Workforce Communications Feature Flags */}
          <div className="mb-6">
            <OrgWCFlagsPanel
              orgId={org.id}
              flags={Object.fromEntries(ALL_WC_FLAGS.map(f => [f, (org as Record<string, unknown>)[f] as boolean ?? false])) as unknown as OrgWCFlags}
            />
          </div>

          {/* Legal Acceptance */}
          <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Legal Acceptance</h2>
            {adminAcceptance ? (
              <dl className="space-y-2 mb-4">
                {([
                  ["Terms version",   adminAcceptance.termsVersion],
                  ["Privacy version", adminAcceptance.privacyVersion],
                  ["Accepted at",     format(new Date(adminAcceptance.acceptedAt), "MMM d, yyyy 'at' h:mm a")],
                  ["IP address",      adminAcceptance.ipAddress ?? "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-gray-500 text-xs shrink-0">{k}</dt>
                    <dd className="text-gray-300 text-xs font-mono text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-amber-400 mb-4">Admin has not yet accepted any legal terms.</p>
            )}
            {usersWithoutAcceptance.length > 0 && (
              <div>
                <p className="text-xs text-red-400 font-medium mb-2">
                  {usersWithoutAcceptance.length} active user{usersWithoutAcceptance.length !== 1 ? "s" : ""} not yet on v{CURRENT_TERMS_VERSION}:
                </p>
                <ul className="space-y-1">
                  {usersWithoutAcceptance.map((u) => (
                    <li key={u.id} className="text-xs text-gray-400">
                      {u.name} <span className="text-gray-600">({u.email}, {u.role})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {usersWithoutAcceptance.length === 0 && adminAcceptance && (
              <p className="text-xs text-green-400">All active users are on current terms.</p>
            )}
          </div>

          {/* CRM — Non-Conversion Reason (shown when Trial Expired with no reason logged) */}
          {org.lifecycleStatus === "Trial Expired" && nonConversionReasons.length === 0 && (
            <div className="mb-6">
              <CrmNonConversionForm orgId={org.id} />
            </div>
          )}

          {/* CRM — Non-Conversion Reasons (already logged) */}
          {nonConversionReasons.length > 0 && (
            <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Non-Conversion Reasons</h2>
              <ul className="space-y-2">
                {nonConversionReasons.map(r => (
                  <li key={r.id} className="text-sm">
                    <span className="text-gray-200">{r.reasonCategory}</span>
                    {r.reasonDetail && <span className="text-gray-400"> — {r.reasonDetail}</span>}
                    <span className="text-gray-600 text-xs ml-2">noted by {r.notedBySAName} · {format(new Date(r.createdAt), "MMM d, yyyy")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CRM Notes */}
          <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">CRM Notes</h2>
            <CrmNotes
              orgId={org.id}
              notes={crmNotes.map(n => ({
                id:              n.id,
                noteText:        n.noteText,
                createdBySAName: n.createdBySAName,
                createdAt:       n.createdAt.toISOString(),
              }))}
            />
          </div>

          {/* CRM Activity Timeline */}
          {crmActivities.length > 0 && (
            <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">CRM Activity</h2>
              <CrmActivityTimeline
                activities={crmActivities.map(a => ({
                  id:              a.id,
                  eventType:       a.eventType,
                  description:     a.description,
                  createdBySAName: a.createdBySAName ?? "System",
                  createdAt:       a.createdAt.toISOString(),
                }))}
              />
            </div>
          )}

          {/* Billing Timeline */}
          <div className="mb-6">
            <BillingTimeline
              org={{
                trialEndsAt:            org.trialEndsAt,
                subscriptionStatus:     org.subscriptionStatus,
                plan:                   org.plan,
                monthlyTotalBeforeDiscount: org.monthlyTotalBeforeDiscount,
                monthlyTotalAfterDiscount:  org.monthlyTotalAfterDiscount,
                discountPercent:        org.discountPercent,
                discountLabel:          org.discountLabel,
              }}
              credits={billingCredits}
            />
          </div>

          {/* Billing Credits */}
          <div className="mb-6">
            <BillingCreditsSection
              orgId={org.id}
              initialCredits={billingCredits.map(c => ({
                id:                        c.id,
                creditType:                c.creditType,
                appliesTo:                 c.appliesTo,
                appliesToDetail:           c.appliesToDetail,
                discountValue:             c.discountValue,
                description:               c.description,
                internalNotes:             c.internalNotes,
                status:                    c.status,
                schedulingType:            c.schedulingType,
                scheduledStartDate:        c.scheduledStartDate?.toISOString() ?? null,
                scheduledStartAfterMonths: c.scheduledStartAfterMonths,
                durationType:              c.durationType,
                durationCycles:            c.durationCycles,
                durationUntilDate:         c.durationUntilDate?.toISOString() ?? null,
                effectiveDate:             c.effectiveDate?.toISOString() ?? null,
                completionDate:            c.completionDate?.toISOString() ?? null,
                stripeCouponId:            c.stripeCouponId,
                reason:                    c.reason,
                createdAt:                 c.createdAt.toISOString(),
              }))}
            />
          </div>

          {/* Referral info */}
          {(org.referralCode || referral) && (
            <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Referral</h2>
              {org.referralCode && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">Code:</span>
                  <code className="text-sm font-mono text-indigo-300 bg-indigo-900/20 px-2 py-0.5 rounded">{org.referralCode}</code>
                  <span className="text-xs text-gray-500">{org.referralLink}</span>
                </div>
              )}
              {referral && (
                <p className="text-xs text-gray-400">
                  Referral status: <span className="text-white">{referral.rewardStatus}</span>
                  {" · "}{referral.consecutiveMonthsPaid}/{referral.qualificationMonthsRequired} months qualifying
                </p>
              )}
            </div>
          )}

          {/* Customer Notes */}
          <div className="mb-6">
            <OrgNotes
              orgId={org.id}
              initialNotes={notes.map((n) => ({
                id:             n.id,
                content:        n.content,
                superAdminName: n.superAdminName,
                createdAt:      n.createdAt.toISOString(),
              }))}
            />
          </div>

          {/* Users table */}
          <UserTable orgId={org.id} users={org.users} />
        </>
      )}

      {/* Diagnostics tab */}
      {activeTab === "diagnostics" && (
        <OrgDiagnostics orgId={org.id} orgName={org.name} />
      )}
    </div>
  )
}
