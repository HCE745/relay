import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listInvoices } from "@/lib/data/invoices"
import { listCustomers } from "@/lib/data/customers"
import { formatMoney, invoiceNo } from "@/lib/money"
import { INVOICE_STATUSES } from "@/lib/zod-schemas"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { ReceiptIcon } from "@/components/ui/icons"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { GenerateInvoiceButton } from "@/components/billing/generate-invoice-button"
import { CustomerFilter } from "@/components/billing/customer-filter"

export const dynamic = "force-dynamic"
const CAP = "billing.invoicing"

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; customerId?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Invoices" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const orgId = session.organizationId
  const { status, customerId } = await searchParams
  const [invoices, customers] = await Promise.all([
    listInvoices(orgId, { status, customerId }),
    listCustomers(orgId),
  ])
  const customerOptions = customers.map((c) => ({ id: c.id, name: c.name }))

  const outstanding = invoices
    .filter((i) => i.status === "SENT")
    .reduce((acc, i) => acc + Number(i.balance.toFixed(2)), 0)

  const chip = (label: string, s?: string) => {
    const params = new URLSearchParams()
    if (s) params.set("status", s)
    if (customerId) params.set("customerId", customerId)
    const qs = params.toString()
    const active = (s ?? undefined) === (status ?? undefined)
    return (
      <Link
        key={label}
        href={`/billing/invoices${qs ? `?${qs}` : ""}`}
        className={`rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Bill customers for completed work"
        action={<GenerateInvoiceButton customers={customerOptions} />}
      />

      <Card className="mb-6 flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-slate-500">Outstanding (sent, unpaid)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(outstanding)}</p>
        </div>
        <Link href="/billing/ar-aging" className="text-sm font-medium text-brand hover:underline">
          AR aging →
        </Link>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chip("All", undefined)}
        {INVOICE_STATUSES.map((s) => chip(s.charAt(0) + s.slice(1).toLowerCase(), s))}
        <div className="ml-auto">
          <CustomerFilter customers={customerOptions} customerId={customerId} status={status} />
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title="No invoices yet"
          description="Generate an invoice from a customer's completed jobs in a date range. Draft invoices land here to review before sending."
          action={<GenerateInvoiceButton customers={customerOptions} />}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/billing/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-brand">
                      {invoiceNo(inv.invoiceNumber)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{inv.customer.name}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {formatMoney(inv.balance, inv.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
