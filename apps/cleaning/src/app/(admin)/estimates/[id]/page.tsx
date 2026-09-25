import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getEstimate } from "@/lib/data/estimates"
import { getOrgSettings } from "@/lib/data/org"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { PrintButton } from "@/components/billing/print-button"
import { EstimateActions } from "@/components/estimates/estimate-actions"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

const TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SENT: "info", ACCEPTED: "success", DECLINED: "danger", EXPIRED: "neutral" }
const LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired" }
const FREQ_LABEL: Record<string, string> = { ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Custom" }
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Estimate" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const [est, org] = await Promise.all([getEstimate(orgId, id), getOrgSettings(orgId)])
  if (!est) notFound()

  const converted = !!est.convertedCustomerId
  const cur = est.currency
  const addr = [est.addressLine1, [est.city, est.state].filter(Boolean).join(", "), est.postalCode].filter(Boolean).join(" · ")
  const rateText = est.rate ? formatMoney(est.rate, cur) : "—"

  return (
    <div>
      <div data-no-print>
        <Link href="/estimates" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand">← Estimates</Link>
        <PageHeader
          title={est.title}
          subtitle={est.lead?.company ?? est.lead?.name ?? est.customer?.name ?? undefined}
          action={
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <a href={`/api/estimates/${est.id}/pdf`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Download PDF
                </a>
                <PrintButton />
                {!converted ? (
                  <Link href={`/estimates/${est.id}/edit`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Edit
                  </Link>
                ) : null}
              </div>
              {!converted ? <EstimateActions estimateId={est.id} status={est.status} /> : null}
            </div>
          }
        />
        {converted ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              Converted{est.convertedAt ? ` on ${fmtDate(est.convertedAt)}` : ""} — this estimate is now read-only and
              linked to the customer it created.
            </p>
            {est.convertedCustomer ? (
              <Link href={`/customers/${est.convertedCustomer.id}`} className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                Open {est.convertedCustomer.name} →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="p-8">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div>
            <div className="text-lg font-semibold text-slate-900">{org?.name ?? "HCE Cleaning"}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Estimate</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-slate-400">Prepared for</div>
            <div className="text-sm font-medium text-slate-800">{est.customer?.name ?? est.lead?.company ?? est.contactName ?? "—"}</div>
            {est.contactName && (est.customer || est.lead?.company) ? <div className="text-sm text-slate-500">{est.contactName}</div> : null}
            {est.contactEmail ? <div className="text-sm text-slate-500">{est.contactEmail}</div> : null}
            {est.siteName || addr ? <div className="text-sm text-slate-500">{[est.siteName, addr].filter(Boolean).join(" — ")}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-slate-900">{est.title}</div>
            <div className="mt-1">
              {converted ? <StatusBadge tone="brand">Converted</StatusBadge> : <StatusBadge tone={TONE[est.status] ?? "neutral"}>{LABEL[est.status] ?? est.status}</StatusBadge>}
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <Row k="Frequency" v={FREQ_LABEL[est.frequency] ?? est.frequency} />
              <Row k="Pricing" v={est.pricing === "HOURLY" ? `Hourly · ${rateText}/hr` : `Per visit${est.rate ? ` · ${rateText}` : ""}`} />
              <Row k="Valid until" v={fmtDate(est.validUntil)} />
            </dl>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {est.lines.length === 0 ? (
              <tr><td colSpan={4} className="py-3 text-slate-400">No line items.</td></tr>
            ) : (
              est.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 text-slate-800">{l.description}</td>
                  <td className="py-3 text-right tabular-nums text-slate-600">{Number(l.quantity)}</td>
                  <td className="py-3 text-right tabular-nums text-slate-600">{formatMoney(l.unitRate, cur)}</td>
                  <td className="py-3 text-right tabular-nums text-slate-800">{formatMoney(l.amount, cur)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums text-slate-700">{formatMoney(est.subtotal, cur)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold"><dt className="text-slate-800">Total</dt><dd className="tabular-nums text-slate-900">{formatMoney(est.total, cur)}</dd></div>
          </dl>
        </div>

        {est.notes ? <p className="mt-6 whitespace-pre-line text-sm text-slate-500">{est.notes}</p> : null}
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-end gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="w-40 text-slate-700">{v}</dd>
    </div>
  )
}
