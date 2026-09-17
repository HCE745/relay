import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getCustomer } from "@/lib/data/customers"
import { getCustomerBilling } from "@/lib/data/invoices"
import { formatMoney, invoiceNo } from "@/lib/money"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusPill } from "@/components/ui/controls"
import { EditCustomerButton } from "@/components/customers/customer-dialogs"
import { ContactsSection } from "@/components/customers/contacts-section"
import { SitesSection } from "@/components/customers/sites-section"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { GenerateInvoiceButton } from "@/components/billing/generate-invoice-button"

export const dynamic = "force-dynamic"

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  DUE_ON_RECEIPT: "Due on receipt",
  NET_15: "Net 15",
  NET_30: "Net 30",
}
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")

  const { id } = await params
  const customer = await getCustomer(session.organizationId, id)
  if (!customer) notFound()

  const hasBilling = await orgHasCapability(session.organizationId, "billing.invoicing")
  const billing = hasBilling ? await getCustomerBilling(session.organizationId, id) : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-slate-500 hover:text-brand">
          ← Customers
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <PageHeader title={customer.name} subtitle={customer.primaryContactName || undefined} />
          <div className="flex items-center gap-3">
            <StatusPill active={customer.isActive} />
            <EditCustomerButton customer={customer} />
          </div>
        </div>
      </div>

      {(customer.email || customer.phone || customer.billingAddress || customer.billingEmail || customer.notes) && (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {customer.email ? <Detail label="Email" value={customer.email} /> : null}
          {customer.phone ? <Detail label="Phone" value={customer.phone} /> : null}
          {customer.billingEmail ? <Detail label="Billing email" value={customer.billingEmail} /> : null}
          <Detail label="Payment terms" value={PAYMENT_TERMS_LABEL[customer.paymentTerms] ?? customer.paymentTerms} />
          {customer.billingAddress ? <Detail label="Billing address" value={customer.billingAddress} /> : null}
          {customer.notes ? <Detail label="Notes" value={customer.notes} /> : null}
        </Card>
      )}

      {billing ? (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Billing</h2>
              <p className="text-xs text-slate-500">
                Outstanding balance:{" "}
                <span className="font-semibold text-slate-900">{formatMoney(billing.outstanding)}</span>
              </p>
            </div>
            <GenerateInvoiceButton customers={[{ id: customer.id, name: customer.name }]} />
          </div>
          {billing.invoices.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">No invoices yet for this customer.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Issued</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billing.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <Link href={`/billing/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {invoiceNo(inv.invoiceNumber)}
                      </Link>
                    </td>
                    <td className="py-2.5 text-slate-500">{fmtDate(inv.issueDate)}</td>
                    <td className="py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-900">
                      {formatMoney(inv.balance, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}

      <ContactsSection customerId={customer.id} contacts={customer.contacts} />
      <SitesSection customerId={customer.id} sites={customer.serviceLocations} />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  )
}
