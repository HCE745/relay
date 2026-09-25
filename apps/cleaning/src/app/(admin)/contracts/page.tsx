import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listContracts } from "@/lib/data/contracts"
import { listCustomers } from "@/lib/data/customers"
import { getContractExpiryLeadDays } from "@/lib/data/org"
import { isExpiringSoon } from "@/lib/contract-terms"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { ReceiptIcon } from "@/components/ui/icons"
import { NewContractButton } from "@/components/contracts/contract-dialogs"

export const dynamic = "force-dynamic"
const CAP = "crm.contracts"

const TONE: Record<string, BadgeTone> = { DRAFT: "neutral", ACTIVE: "success", EXPIRED: "warning", CANCELLED: "danger" }
const LABEL: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Active", EXPIRED: "Expired", CANCELLED: "Cancelled" }
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Contracts" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { filter } = await searchParams
  const expiringOnly = filter === "expiring"
  const [all, customers, leadDays] = await Promise.all([
    listContracts(orgId),
    listCustomers(orgId),
    getContractExpiryLeadDays(orgId),
  ])
  const now = new Date()
  const contracts = expiringOnly
    ? all.filter((c) => c.status === "ACTIVE" && isExpiringSoon(c.endDate, leadDays, now))
    : all
  const customerOptions = customers.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Commercial terms and agreements — contract value vs. what you've actually invoiced"
        action={<NewContractButton customers={customerOptions} />}
      />

      {expiringOnly ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>Showing active contracts expiring within {leadDays} days.</span>
          <Link href="/contracts" className="font-medium hover:underline">Show all</Link>
        </div>
      ) : null}

      {contracts.length === 0 ? (
        expiringOnly ? (
          <EmptyState icon={<ReceiptIcon />} title="No contracts expiring soon" description={`No active contracts end within the next ${leadDays} days.`} actionLabel="Show all contracts" actionHref="/contracts" />
        ) : (
          <EmptyState
            icon={<ReceiptIcon />}
            title="No contracts yet"
            description="Record a customer's commercial terms — value, term dates and billing frequency — then optionally link their service plans to track invoiced revenue against the contract value. Contracts never change how invoicing works."
            action={<NewContractButton customers={customerOptions} />}
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Contract</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Term</th>
                <th className="px-4 py-2.5 text-right font-medium">Value</th>
                <th className="px-4 py-2.5 text-right font-medium">Invoiced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c) => {
                const expiring = c.status === "ACTIVE" && isExpiringSoon(c.endDate, leadDays, now)
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/contracts/${c.id}`} className="font-medium text-slate-900 hover:text-brand">{c.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={TONE[c.status] ?? "neutral"}>{LABEL[c.status] ?? c.status}</StatusBadge>
                        {expiring ? <StatusBadge tone="warning">Expiring</StatusBadge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.contractValue != null ? formatMoney(c.contractValue) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(c.invoiced)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
