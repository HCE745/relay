import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listEstimates } from "@/lib/data/estimates"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { ReceiptIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

const TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SENT: "info", ACCEPTED: "success", DECLINED: "danger", EXPIRED: "neutral" }
const LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired" }
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function EstimatesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Estimates" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const estimates = await listEstimates(session.organizationId)
  const newButton = (
    <Link href="/estimates/new" className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
      New estimate
    </Link>
  )

  return (
    <div>
      <PageHeader title="Estimates" subtitle="Quotes that convert into customers" action={newButton} />

      {estimates.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title="No estimates yet"
          description="Build a priced estimate for a lead or prospect. When it's accepted, one click creates the customer, site and service plan."
          actionLabel="New estimate"
          actionHref="/estimates/new"
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Estimate</th>
                <th className="px-4 py-2.5 font-medium">For</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Pricing</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Valid until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/estimates/${e.id}`} className="font-medium text-slate-900 hover:text-brand">{e.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.convertedCustomer ? (
                      <span className="text-emerald-700">✓ {e.convertedCustomer.name}</span>
                    ) : (
                      e.customer?.name ?? e.lead?.company ?? e.lead?.name ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.convertedCustomerId ? (
                      <StatusBadge tone="brand">Converted</StatusBadge>
                    ) : (
                      <StatusBadge tone={TONE[e.status] ?? "neutral"}>{LABEL[e.status] ?? e.status}</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.pricing === "HOURLY" ? "Hourly" : "Per visit"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(e.total, e.currency)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(e.validUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
