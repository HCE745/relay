import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getExcludedAddressDetail } from "@/lib/data/service-areas"
import { orgDb } from "@/lib/org-db"
import { PageHeader } from "@/components/ui/placeholder"
import { MapPinIcon } from "@/components/ui/icons"
import { ExclusionDetailClient, type ExclusionDetail, type CustomerOption } from "@/components/service-areas/exclusion-detail"

export const dynamic = "force-dynamic"
const CAP = "operations.serviceAreas"
const iso = (d: Date | null) => (d ? d.toISOString() : null)

export default async function ExclusionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) redirect("/dashboard")

  const { id } = await params
  const [row, customerRows] = await Promise.all([
    getExcludedAddressDetail(orgId, id),
    orgDb(orgId).customer.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, serviceLocations: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    }),
  ])
  if (!row) notFound()

  const ex: ExclusionDetail = {
    id: row.id,
    address: [row.addressLine1, row.city, row.state, row.postalCode].filter(Boolean).join(", "),
    reason: row.reason,
    note: row.note,
    status: row.status,
    isPropertySpecific: row.isPropertySpecific,
    incidentDate: iso(row.incidentDate),
    occupantName: row.occupantName,
    occupantPhone: row.occupantPhone,
    occupantEmail: row.occupantEmail,
    occupantChangeVerifiedAt: iso(row.occupantChangeVerifiedAt),
    liftedAt: iso(row.liftedAt),
    liftReason: row.liftReason,
    customerNameSnapshot: row.customerNameSnapshot,
    customer: row.customer
      ? { id: row.customer.id, name: row.customer.name, archivedAt: iso(row.customer.archivedAt), contracts: row.customer.contracts.map((c) => ({ id: c.id, title: c.title, status: c.status })) }
      : null,
    serviceLocation: row.serviceLocation ? { id: row.serviceLocation.id, name: row.serviceLocation.name } : null,
    events: row.events.map((e) => ({
      id: e.id, type: e.type, note: e.note, actorName: e.actorName,
      occupantName: e.occupantName, verifiedAt: iso(e.verifiedAt), createdAt: e.createdAt.toISOString(),
    })),
  }
  const customers: CustomerOption[] = customerRows.map((c) => ({ id: c.id, name: c.name, locations: c.serviceLocations }))

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/service-areas" className="text-sm text-slate-500 hover:text-brand">← Service areas</Link>
      <div className="mt-2">
        <PageHeader title="Address exclusion" subtitle={ex.address} icon={<MapPinIcon />} />
      </div>
      <ExclusionDetailClient ex={ex} customers={customers} />
    </div>
  )
}
