import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getContract, listLinkablePlans } from "@/lib/data/contracts"
import { getContractExpiryLeadDays } from "@/lib/data/org"
import { isExpiringSoon, daysUntil } from "@/lib/contract-terms"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { EditContractButton, type ContractValues } from "@/components/contracts/contract-dialogs"
import { ContractPlansEditor } from "@/components/contracts/contract-plans"

export const dynamic = "force-dynamic"
const CAP = "crm.contracts"

const TONE: Record<string, BadgeTone> = { DRAFT: "neutral", ACTIVE: "success", EXPIRED: "warning", CANCELLED: "danger" }
const LABEL: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Active", EXPIRED: "Expired", CANCELLED: "Cancelled" }
const FREQ_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUALLY: "Annually", ONE_TIME: "One-time" }
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const dateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "")

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Contract" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const result = await getContract(orgId, id)
  if (!result) notFound()
  const { contract: c, progress } = result
  const [plans, leadDays] = await Promise.all([listLinkablePlans(orgId, c.customerId), getContractExpiryLeadDays(orgId)])

  const now = new Date()
  const expiring = c.status === "ACTIVE" && isExpiringSoon(c.endDate, leadDays, now)
  const daysLeft = c.endDate ? daysUntil(c.endDate, now) : null

  const editValues: ContractValues = {
    id: c.id,
    title: c.title,
    startDate: dateInput(c.startDate),
    endDate: dateInput(c.endDate),
    autoRenew: c.autoRenew,
    contractValue: c.contractValue != null ? c.contractValue.toString() : "",
    billingFrequency: c.billingFrequency,
    status: c.status,
    documentUrl: c.documentUrl ?? "",
    notes: c.notes ?? "",
  }

  // Value-vs-invoiced bar: share of contract value invoiced so far, clamped 0–100
  // for the bar width while the real percentage is shown as text.
  const pct = progress.pct
  const barWidth = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const over = progress.remaining != null && progress.remaining.isNegative()

  return (
    <div>
      <Link href="/contracts" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand">← Contracts</Link>
      <PageHeader
        title={c.title}
        subtitle={c.customer.name}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge tone={TONE[c.status] ?? "neutral"}>{LABEL[c.status] ?? c.status}</StatusBadge>
            {expiring ? <StatusBadge tone="warning">Expiring</StatusBadge> : null}
            <EditContractButton contract={editValues} />
          </div>
        }
      />

      {expiring ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This contract ends {fmtDate(c.endDate)}{daysLeft != null ? ` — ${daysLeft} day${daysLeft === 1 ? "" : "s"} away` : ""}. Renewals are handled manually.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Prominent value-vs-invoiced comparison */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700">Contract value vs. invoiced</h2>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Contract value</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{progress.value != null ? formatMoney(progress.value) : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Invoiced to date</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{formatMoney(progress.invoiced)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{over ? "Over by" : "Remaining"}</div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${over ? "text-orange-600" : "text-slate-900"}`}>
                {progress.remaining != null ? formatMoney(over ? progress.remaining.abs() : progress.remaining) : "—"}
              </div>
            </div>
          </div>
          {progress.value != null ? (
            <div className="mt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${over ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${barWidth}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{pct != null ? `${pct}% of contract value invoiced` : "No contract value set to compare against."}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Set a contract value to compare it against invoiced revenue. Invoiced revenue is the sum of non-void invoice lines from jobs on this contract&apos;s linked service plans, within the contract term.</p>
          )}
        </Card>

        {/* Terms */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700">Terms</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Start" v={fmtDate(c.startDate)} />
            <Row k="End" v={c.endDate ? fmtDate(c.endDate) : "Open-ended"} />
            <Row k="Billing" v={FREQ_LABEL[c.billingFrequency] ?? c.billingFrequency} />
            <Row k="Auto-renews" v={c.autoRenew ? "Yes (informational)" : "No"} />
            {c.documentUrl ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Document</dt>
                <dd className="truncate"><a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open</a></dd>
              </div>
            ) : null}
          </dl>
          {c.notes ? <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-500">{c.notes}</p> : null}
        </Card>
      </div>

      {/* Linked service plans (optional) */}
      <Card className="mt-6 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Linked service plans</h2>
        <p className="mt-1 text-sm text-slate-500">
          Linking a plan attributes its invoiced revenue to this contract. It&apos;s optional and changes nothing about how invoices are generated.
        </p>
        <div className="mt-4">
          <ContractPlansEditor contractId={c.id} plans={plans} />
        </div>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-slate-700">{v}</dd>
    </div>
  )
}
