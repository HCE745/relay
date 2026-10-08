import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listServiceAreas, listExclusions } from "@/lib/data/service-areas"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { MapPinIcon } from "@/components/ui/icons"
import { ServiceAreasClient } from "@/components/service-areas/service-areas-client"

export const dynamic = "force-dynamic"
const CAP = "operations.serviceAreas"

export default async function ServiceAreasPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Service areas" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [areas, exclusions] = await Promise.all([listServiceAreas(orgId), listExclusions(orgId)])

  return (
    <div>
      <PageHeader title="Service areas" subtitle="Where you work, and who you don't serve" icon={<MapPinIcon />} />
      <ServiceAreasClient
        areas={areas.map((a) => ({
          id: a.id, name: a.name, zipCodes: a.zipCodes, radiusMiles: a.radiusMiles ? Number(a.radiusMiles) : null,
          officeLabel: a.officeLabel, active: a.active,
        }))}
        exclusions={{
          addresses: exclusions.addresses.map((e) => ({ id: e.id, label: [e.addressLine1, e.city, e.postalCode].filter(Boolean).join(", "), reason: e.reason, note: e.note })),
          contacts: exclusions.contacts.map((e) => ({ id: e.id, label: [e.name, e.phone, e.email].filter(Boolean).join(" · ") || "—", reason: e.reason, note: e.note })),
          zones: exclusions.zones.map((e) => ({ id: e.id, label: e.value, reason: e.reason, note: e.note })),
        }}
      />
    </div>
  )
}
