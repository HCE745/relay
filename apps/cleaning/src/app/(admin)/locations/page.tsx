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
      <PageHeader title="Service locations" subtitle="Every site you service, across all customers" />
      {sites.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon />}
          title="No service locations yet"
          description="Service locations are the sites you clean. Each one lives under a customer — open a customer to add their first site."
          actionLabel="Go to Customers"
          actionHref="/customers"
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${s.customerId}/sites/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.customer.name}</td>
                  <td className="px-4 py-3 text-slate-600">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={s.isActive} />
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
