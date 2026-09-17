import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getInvoice } from "@/lib/data/invoices"
import { getOrgSettings } from "@/lib/data/org"
import { formatMoney, invoiceNo } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { InvoiceActions } from "@/components/billing/invoice-actions"
import { PrintButton } from "@/components/billing/print-button"

export const dynamic = "force-dynamic"
const CAP = "billing.invoicing"

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Invoice" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const [invoice, org] = await Promise.all([getInvoice(session.organizationId, id), getOrgSettings(session.organizationId)])
  if (!invoice) notFound()

  const cur = invoice.currency
  const paid = invoice.payments.reduce((acc, p) => acc + Number(p.amount.toFixed(2)), 0)
  const balance = Number(invoice.total.toFixed(2)) - paid

  return (
    <div>
      <div data-no-print>
        <Link href="/billing/invoices" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand">
          ← Invoices
        </Link>
        <PageHeader
          title={invoiceNo(invoice.invoiceNumber)}
          subtitle={invoice.customer.name}
          action={
            <div className="flex items-center gap-2">
              <PrintButton />
              <InvoiceActions invoiceId={invoice.id} status={invoice.status} balance={balance.toFixed(2)} />
            </div>
          }
        />
      </div>

      <Card className="p-8">
        {/* Document header */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div>
            <div className="text-lg font-semibold text-slate-900">{org?.name ?? "HCE Cleaning"}</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-slate-400">Bill to</div>
            <div className="text-sm font-medium text-slate-800">{invoice.customer.name}</div>
            {invoice.customer.billingEmail || invoice.customer.email ? (
              <div className="text-sm text-slate-500">{invoice.customer.billingEmail ?? invoice.customer.email}</div>
            ) : null}
            {invoice.customer.billingAddress ? (
              <div className="whitespace-pre-line text-sm text-slate-500">{invoice.customer.billingAddress}</div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-900">{invoiceNo(invoice.invoiceNumber)}</div>
            <div className="mt-1">
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Issued</dt>
                <dd className="w-28 text-slate-700">{fmtDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Due</dt>
                <dd className="w-28 text-slate-700">{fmtDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Period</dt>
                <dd className="w-28 text-slate-700">
                  {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Lines */}
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Service date</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-3">
                  <div className="text-slate-800">{l.description}</div>
                  {l.siteName ? <div className="text-xs text-slate-400">{l.siteName}</div> : null}
                </td>
                <td className="py-3 text-slate-500">{fmtDate(l.serviceDate)}</td>
                <td className="py-3 text-right tabular-nums text-slate-600">{Number(l.quantity)}</td>
                <td className="py-3 text-right tabular-nums text-slate-600">{formatMoney(l.unitRate, cur)}</td>
                <td className="py-3 text-right tabular-nums text-slate-800">{formatMoney(l.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <dl className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums text-slate-700">{formatMoney(invoice.subtotal, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="tabular-nums text-slate-700">{formatMoney(invoice.taxTotal, cur)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
              <dt className="text-slate-800">Total</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(invoice.total, cur)}</dd>
            </div>
            {paid > 0 ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Paid</dt>
                <dd className="tabular-nums text-emerald-600">−{formatMoney(paid, cur)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
              <dt className="text-slate-800">Balance due</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(balance, cur)}</dd>
            </div>
          </dl>
        </div>

        {invoice.notes ? <p className="mt-6 whitespace-pre-line text-sm text-slate-500">{invoice.notes}</p> : null}

        {/* Payments */}
        {invoice.payments.length > 0 ? (
          <div className="mt-8 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Payments</h3>
            <ul className="space-y-1 text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex justify-between text-slate-600">
                  <span>
                    {fmtDate(p.receivedDate)}
                    {p.method ? ` · ${p.method}` : ""}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="tabular-nums">{formatMoney(p.amount, cur)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
