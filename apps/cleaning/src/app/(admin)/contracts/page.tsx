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
import { ReceiptIcon, FileTextIcon } from "@/components/ui/icons"
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
        icon={<FileTextIcon />}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {contracts.map((c) => {
            const expiring = c.status === "ACTIVE" && isExpiringSoon(c.endDate, leadDays, now)
            const value = c.contractValue != null ? Number(c.contractValue) : null
            const invoiced = Number(c.invoiced)
            const pct = value && value > 0 ? Math.max(0, Math.min(100, Math.round((invoiced / value) * 100))) : null
            return (
              <Link key={c.id} href={`/contracts/${c.id}`} className="group">
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-brand">{c.title}</div>
                      <div className="truncate text-xs text-slate-500">{c.customer?.name ?? "—"}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={TONE[c.status] ?? "neutral"}>{LABEL[c.status] ?? c.status}</StatusBadge>
                      {expiring ? <StatusBadge tone="warning">Expiring</StatusBadge> : null}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-slate-500">Invoiced</span>
                      <span className="tabular-nums font-semibold text-slate-900">
                        {formatMoney(c.invoiced)}{value != null ? <span className="font-normal text-slate-400"> / {formatMoney(c.contractValue!)}</span> : null}
                      </span>
                    </div>
                    {pct != null ? (
                      <div className="mt-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{pct}% of contract value · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-slate-500">No contract value set · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}</div>
                    )}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
