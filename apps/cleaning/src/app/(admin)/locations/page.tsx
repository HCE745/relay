import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listAllSites } from "@/lib/data/service-locations"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusPill, EmptyState } from "@/components/ui/controls"
import { MapPinIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "core.locations"

export default async function LocationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Service locations" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const sites = await listAllSites(session.organizationId)

  return (
    <div>
      <PageHeader title="Service locations" subtitle="Every site you service, across all customers" icon={<MapPinIcon />} />
      {sites.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon />}
          title="No service locations yet"
          description="Service locations are the sites you clean. Each one lives under a customer — open a customer to add their first site."
          actionLabel="Go to Customers"
          actionHref="/customers"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => (
            <Link key={s.id} href={`/customers/${s.customerId}/sites/${s.id}`} className="group">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <MapPinIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-brand">{s.name}</div>
                      <div className="truncate text-xs text-slate-500">{s.customer.name}</div>
                    </div>
                  </div>
                  <StatusPill active={s.isActive} />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {[s.city, s.state].filter(Boolean).join(", ") || "No address on file"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
