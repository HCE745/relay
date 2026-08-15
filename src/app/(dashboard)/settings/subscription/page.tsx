import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import Link from "next/link"
import { ManageBillingButton } from "./manage-billing-button"
import {
  CheckCircle, AlertTriangle, Clock, CreditCard, Zap, MapPin, Users,
  Package, ChevronRight,
} from "lucide-react"
import {
  PLANS, INTELLIGENCE_MODULES, INTELLIGENCE_SUITE_PRICE,
  calculatePrice, isProfessional, isReadOnly, isTrial, isWashEssentials,
  WASH_ESSENTIALS_MAX_LOCATIONS,
  type PlanKey, type ModuleId,
} from "@/lib/pricing"
import { format, formatDistanceToNowStrict } from "date-fns"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  trialing:  "Free Trial",
  active:    "Active",
  past_due:  "Past Due",
  canceled:  "Canceled",
  expired:   "Expired",
  read_only: "Expired (Read-Only)",
  suspended: "Suspended",
}

const STATUS_COLOR: Record<string, string> = {
  trialing:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  past_due:  "bg-orange-100 text-orange-700",
  canceled:  "bg-gray-100 text-gray-600",
  expired:   "bg-red-100 text-red-700",
  read_only: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default async function SubscriptionSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.isDemo) redirect("/dashboard")
  if (session.role !== "ADMIN") redirect("/settings")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      name:              true,
      plan:              true,
      productLine:       true,
      subscriptionStatus: true,
      trialStartDate:    true,
      trialEndsAt:       true,
      employeeLimit:     true,
      locationLimit:     true,
      intelligenceModules:      true,
      intelligenceSuiteEnabled: true,
      monthlyBasePrice:           true,
      monthlyScalingCost:         true,
      monthlyModulesCost:         true,
      monthlyTotalBeforeDiscount: true,
      monthlyTotalAfterDiscount:  true,
      discountPercent:   true,
      discountExpiresAt: true,
      discountLabel:     true,
      checkoutIntentStatus:  true,
      stripeCustomerId:      true,
      stripeSubscriptionId:  true,
      _count: { select: { users: true, locations: true } },
    },
  })

  if (!org) redirect("/dashboard")

  const status      = org.subscriptionStatus ?? "trialing"
  const plan        = (["essentials", "professional", "professional_plus", "wash_essentials"] as const).includes(org.plan as PlanKey)
    ? org.plan as PlanKey : null
  const planLabel   = plan ? PLANS[plan].label : org.plan
  const readOnly    = isReadOnly(status)
  const trialing    = isTrial(status)
  const professional = isProfessional(org.plan)
  const isPP        = org.plan === "professional_plus" || org.plan === "enterprise"

  // Days remaining in trial
  const now         = new Date()
  const trialEnd    = org.trialEndsAt ? new Date(org.trialEndsAt) : null
  const daysLeft    = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null

  const isWE = isWashEssentials(org.productLine)

  // Usage vs subscription coverage
  const actualUsers     = org._count.users
  const actualLocations = org._count.locations
  const coveredUsers    = org.employeeLimit ?? (plan ? PLANS[plan].includedEmployees : 0)
  const coveredLocations = org.locationLimit ?? (plan ? PLANS[plan].includedLocations : 0)
  const usersOverLimit  = !isWE && coveredUsers > 0 && actualUsers > coveredUsers
  const locsOverLimit   = !isWE && coveredLocations > 0 && actualLocations > coveredLocations

  // Wash Essentials live pricing from actual location count (authoritative at display time)
  const weAdditional = isWE ? Math.max(0, actualLocations - 1) : 0
  const weBase       = 40
  const weTotal      = isWE ? weBase + weAdditional * 10 : 0
  const weDiscount   = isWE && org.discountPercent ? Math.round(weTotal * (org.discountPercent / 100)) : 0
  const weFinal      = weTotal - weDiscount

  // Live pricing for over-limit warning
  const overLimitPricing = (usersOverLimit || locsOverLimit) && plan
    ? calculatePrice({
        plan,
        employeeCount:     actualUsers,
        locationCount:     actualLocations,
        selectedModuleIds: (org.intelligenceModules ?? []).filter((m): m is ModuleId =>
          INTELLIGENCE_MODULES.some(im => im.id === m)
        ),
        intelligenceSuite: org.intelligenceSuiteEnabled ?? false,
        discountPercent:   org.discountPercent ?? undefined,
      })
    : null

  const activeModules = INTELLIGENCE_MODULES.filter(m => (org.intelligenceModules ?? []).includes(m.id))

  return (
    <div>
      <Header title="Subscription" />
      <div className="p-6 max-w-2xl space-y-5">

        {/* Status card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{org.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{planLabel}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[status] ?? STATUS_COLOR.canceled}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          {isWE ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Plan"   value={planLabel} />
                <Stat label="Status" value={STATUS_LABEL[status] ?? status} />
              </div>
              {/* Location usage progress for Wash Essentials */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Locations
                  </p>
                  <p className="text-xs font-semibold text-gray-700">
                    {actualLocations} / {WASH_ESSENTIALS_MAX_LOCATIONS}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      actualLocations >= WASH_ESSENTIALS_MAX_LOCATIONS
                        ? "bg-orange-400"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.round((actualLocations / WASH_ESSENTIALS_MAX_LOCATIONS) * 100)}%` }}
                  />
                </div>
                {actualLocations >= WASH_ESSENTIALS_MAX_LOCATIONS && (
                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    At the Wash Essentials limit. Upgrade to add more locations.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Plan"   value={planLabel} />
              <Stat label="Status" value={STATUS_LABEL[status] ?? status} />
              <Stat label="Employees" value={`${org.employeeLimit ?? "—"} covered`} />
              <Stat label="Locations" value={`${org.locationLimit ?? "—"} covered`} />
            </div>
          )}

          {/* Trial info */}
          {trialing && trialEnd && (
            <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
              daysLeft !== null && daysLeft <= 3
                ? "bg-red-50 border border-red-200 text-red-700"
                : daysLeft !== null && daysLeft <= 6
                ? "bg-amber-50 border border-amber-200 text-amber-700"
                : "bg-blue-50 border border-blue-200 text-blue-700"
            }`}>
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                {daysLeft === 0
                  ? "Trial expires today"
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
                {" · "}Expires {format(trialEnd, "MMM d, yyyy")}
              </span>
            </div>
          )}

          {/* Expired */}
          {readOnly && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Trial expired {trialEnd ? formatDistanceToNowStrict(trialEnd, { addSuffix: true }) : ""}.
                Your data is preserved. Subscribe to restore full access.
              </span>
            </div>
          )}

          {/* Usage overage warning */}
          {(usersOverLimit || locsOverLimit) && overLimitPricing && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Usage exceeds current plan coverage
              </p>
              <ul className="space-y-0.5 ml-5 list-disc text-amber-700">
                {usersOverLimit && <li>{actualUsers} active users, {coveredUsers} covered</li>}
                {locsOverLimit  && <li>{actualLocations} locations, {coveredLocations} covered</li>}
              </ul>
              <p className="mt-2 text-amber-700">
                Adjusted monthly price based on current usage:{" "}
                <strong>${overLimitPricing.totalAfterDiscount}/mo</strong>
              </p>
            </div>
          )}
        </div>

        {/* Pricing breakdown */}
        {isWE ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Monthly pricing
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Wash Essentials base (1 location included)</span>
                <span className="text-gray-900">${weBase}/mo</span>
              </div>
              {weAdditional > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">+{weAdditional} additional location{weAdditional !== 1 ? "s" : ""}</span>
                  <span className="text-gray-900">+${weAdditional * 10}/mo</span>
                </div>
              )}
              {weDiscount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>
                    {org.discountLabel ?? "Discount"} ({org.discountPercent}% off
                    {org.discountExpiresAt && `, until ${format(new Date(org.discountExpiresAt), "MMM yyyy")}`})
                  </span>
                  <span>−${weDiscount}/mo</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span className="text-gray-900">Monthly total</span>
                <span className="text-gray-900">${weFinal}/mo</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Billing updates automatically when you add or remove locations.
            </p>
          </div>
        ) : org.monthlyTotalBeforeDiscount != null ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Monthly pricing
            </h2>
            <div className="space-y-2 text-sm">
              {org.monthlyBasePrice != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Base plan</span>
                  <span className="text-gray-900">${org.monthlyBasePrice}/mo</span>
                </div>
              )}
              {org.monthlyScalingCost != null && org.monthlyScalingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Scaling (employees + locations)</span>
                  <span className="text-gray-900">+${org.monthlyScalingCost}/mo</span>
                </div>
              )}
              {org.monthlyModulesCost != null && org.monthlyModulesCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Intelligence Modules</span>
                  <span className="text-gray-900">+${org.monthlyModulesCost}/mo</span>
                </div>
              )}
              {org.discountPercent && org.monthlyTotalBeforeDiscount != null && (
                <div className="flex justify-between text-green-700">
                  <span>
                    {org.discountLabel ?? "Discount"} ({org.discountPercent}% off
                    {org.discountExpiresAt && `, until ${format(new Date(org.discountExpiresAt), "MMM yyyy")}`})
                  </span>
                  <span>−${Math.round(org.monthlyTotalBeforeDiscount * (org.discountPercent / 100))}/mo</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span className="text-gray-900">Monthly total</span>
                <span className="text-gray-900">
                  ${org.monthlyTotalAfterDiscount ?? org.monthlyTotalBeforeDiscount}/mo
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modules — not available for Wash Essentials */}
        {!isWE && professional && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              Intelligence Modules
            </h2>
            {org.intelligenceSuiteEnabled ? (
              <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                <Package className="w-4 h-4" />
                Relay Intelligence Suite — all modules included
                <span className="ml-auto font-semibold">
                  {isPP ? "Included in plan" : `$${INTELLIGENCE_SUITE_PRICE}/mo`}
                </span>
              </div>
            ) : activeModules.length === 0 ? (
              <p className="text-sm text-gray-500">No Intelligence Modules added.</p>
            ) : (
              <div className="space-y-2">
                {activeModules.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-gray-700">{m.label}</span>
                    </div>
                    <span className="text-gray-500">${m.price}/mo</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending checkout */}
        {org.checkoutIntentStatus === "pending" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Checkout pending</p>
              <p className="text-xs mt-0.5">Your plan selections have been saved. Our team will be in touch to complete your subscription setup.</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isWE ? (
            <>
              <Link
                href="/settings/subscription/upgrade"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Upgrade to Full Relay
                <ChevronRight className="w-4 h-4" />
              </Link>
              <ManageBillingButton hasStripeCustomer={!!org.stripeCustomerId} />
            </>
          ) : (
            <>
              <Link
                href="/subscribe"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {org.subscriptionStatus === "active" ? "Change Plan" : "Subscribe Now"}
                <ChevronRight className="w-4 h-4" />
              </Link>
              {!professional && (
                <Link
                  href="/subscribe?highlight=modules"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-blue-400 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  <Zap className="w-4 h-4 text-indigo-600" />
                  Add Modules
                </Link>
              )}
              <ManageBillingButton hasStripeCustomer={!!org.stripeCustomerId} />
            </>
          )}
        </div>

        {/* Coverage info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Current usage
          </h2>
          <div className={`grid gap-4 ${isWE ? "grid-cols-1" : "grid-cols-2"}`}>
            {!isWE && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Users className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Users</p>
                  <p className={`text-sm font-semibold ${usersOverLimit ? "text-amber-600" : "text-gray-900"}`}>
                    {actualUsers} {org.employeeLimit ? `/ ${org.employeeLimit}` : ""}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Locations</p>
                <p className={`text-sm font-semibold ${locsOverLimit ? "text-amber-600" : "text-gray-900"}`}>
                  {isWE
                    ? `${actualLocations} / ${WASH_ESSENTIALS_MAX_LOCATIONS}`
                    : `${actualLocations}${org.locationLimit ? ` / ${org.locationLimit}` : ""}`}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
