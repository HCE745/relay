import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listCustomers } from "@/lib/data/customers"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusPill, EmptyState } from "@/components/ui/controls"
import { BuildingIcon } from "@/components/ui/icons"
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
      <PageHeader title="Customers" subtitle="The companies you clean for" icon={<BuildingIcon />} action={<NewCustomerButton />} />

      {customers.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon />}
          title="No customers yet"
          description="Customers are the companies you clean for. Add your first one to start creating locations and scheduling work."
          action={<NewCustomerButton />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="group">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <BuildingIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-brand">{c.name}</div>
                      <div className="truncate text-xs text-slate-500">{c.primaryContactName || "No primary contact"}</div>
                    </div>
                  </div>
                  <StatusPill active={c.isActive} />
                </div>
                <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span><span className="font-semibold text-slate-700">{c._count.serviceLocations}</span> {c._count.serviceLocations === 1 ? "site" : "sites"}</span>
                  <span><span className="font-semibold text-slate-700">{c._count.contacts}</span> {c._count.contacts === 1 ? "contact" : "contacts"}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
