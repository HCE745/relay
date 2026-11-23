import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { canManageOrg } from "@/lib/rbac"
import { PageHeader } from "@/components/ui/placeholder"
import { CogIcon } from "@/components/ui/icons"
import { Card } from "@/components/ui/controls"
import { isBillingConfigured } from "@/lib/subscription/stripe-subscriptions"
import { purchasablePlans } from "@/lib/subscription/plans"
import { BillingActions } from "@/components/settings/billing-actions"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null
}

export default async function BillingSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const isOrgAdmin = canManageOrg(session.role)

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      packageTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      purchasedSeats: true,
      billingInterval: true,
      cancelAtPeriodEnd: true,
      stripeCustomerId: true,
    },
  })

  const billingConfigured = isBillingConfigured()
  const trialing = org?.subscriptionStatus === "trialing"
  const plans = purchasablePlans().map((p) => ({
    tier: p.tier,
    name: p.name,
    includedSeats: p.includedSeats,
    monthly: p.amountCents.monthly,
    annual: p.amountCents.annual,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & plan" subtitle="Your subscription and payment method" icon={<CogIcon />} />

      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Plan</dt>
            <dd className="text-sm font-medium text-slate-900">{org?.packageTier}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
            <dd className="text-sm font-medium text-slate-900">{org?.subscriptionStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {trialing ? "Trial ends" : "Renews"}
            </dt>
            <dd className="text-sm font-medium text-slate-900">
              {fmtDate(trialing ? (org?.trialEndsAt ?? null) : (org?.currentPeriodEnd ?? null)) ?? "—"}
            </dd>
          </div>
        </dl>
        {org?.cancelAtPeriodEnd ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Your subscription is set to cancel at the end of the current period. Your data is preserved.
          </p>
        ) : null}
        {trialing ? (
          <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 ring-1 ring-sky-200">
            Adding a payment method now saves your plan but does <strong>not</strong> charge you &mdash; your first
            payment is scheduled for when your trial ends{fmtDate(org?.trialEndsAt ?? null) ? ` (${fmtDate(org?.trialEndsAt ?? null)})` : ""}.
            You&rsquo;ll never be charged before then; if fewer than two days remain when you subscribe, your first
            charge may fall up to 48 hours later, never sooner.
          </p>
        ) : null}
      </Card>

      {isOrgAdmin ? (
        billingConfigured ? (
          <BillingActions plans={plans} hasStripeCustomer={!!org?.stripeCustomerId} currentTier={org?.packageTier ?? ""} />
        ) : (
          <Card className="p-6">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">Upgrade</h2>
            <p className="text-sm text-slate-600">
              Online billing isn&rsquo;t enabled yet. To add a payment method or change your plan, contact CleanWare.
            </p>
          </Card>
        )
      ) : (
        <Card className="p-6">
          <p className="text-sm text-slate-600">Only owners and admins can manage billing.</p>
        </Card>
      )}
    </div>
  )
}
