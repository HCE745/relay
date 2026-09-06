import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listCustomers } from "@/lib/data/customers"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusPill, EmptyState } from "@/components/ui/controls"
import { NewCustomerButton } from "@/components/customers/customer-dialogs"

export const dynamic = "force-dynamic"
const CAP = "core.customers"

export default async function CustomersPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Customers" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const customers = await listCustomers(session.organizationId)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Customers" subtitle="The companies you clean for" />
        <NewCustomerButton />
      </div>

      {customers.length === 0 ? (
        <EmptyState title="No customers yet">Create your first cleaning customer to get started.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Primary contact</th>
                <th className="px-4 py-2.5 font-medium">Sites</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:text-brand">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.primaryContactName || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c._count.serviceLocations}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={c.isActive} />
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
