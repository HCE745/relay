import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { getCustomer } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusPill } from "@/components/ui/controls"
import { EditCustomerButton } from "@/components/customers/customer-dialogs"
import { ContactsSection } from "@/components/customers/contacts-section"
import { SitesSection } from "@/components/customers/sites-section"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")

  const { id } = await params
  const customer = await getCustomer(session.organizationId, id)
  if (!customer) notFound()

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

      {(customer.email || customer.phone || customer.billingAddress || customer.notes) && (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {customer.email ? <Detail label="Email" value={customer.email} /> : null}
          {customer.phone ? <Detail label="Phone" value={customer.phone} /> : null}
          {customer.billingAddress ? <Detail label="Billing address" value={customer.billingAddress} /> : null}
          {customer.notes ? <Detail label="Notes" value={customer.notes} /> : null}
        </Card>
      )}

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
