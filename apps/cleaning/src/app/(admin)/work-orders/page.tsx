import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listWorkOrders } from "@/lib/data/work-orders"
import { listCustomers } from "@/lib/data/customers"
import { orgDb } from "@/lib/org-db"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { BriefcaseIcon } from "@/components/ui/icons"
import { WorkOrdersClient, NewWorkOrderButton } from "@/components/work-orders/work-orders-client"

export const dynamic = "force-dynamic"
const CAP = "operations.workOrders"

export default async function WorkOrdersPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Work orders" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [workOrders, customers] = await Promise.all([
    listWorkOrders(orgId),
    orgDb(orgId).customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, serviceLocations: { where: { isActive: true }, select: { id: true, name: true } } } }),
  ])
  void listCustomers

  return (
    <div>
      <PageHeader
        title="Work orders"
        subtitle="One-time & emergency work — quote, schedule, and bill it"
        icon={<BriefcaseIcon />}
        action={<NewWorkOrderButton customers={customers.map((c) => ({ id: c.id, name: c.name, sites: c.serviceLocations }))} />}
      />
      <WorkOrdersClient
        workOrders={workOrders.map((w) => ({
          id: w.id, type: w.type, description: w.description, priority: w.priority, status: w.status,
          quotedAmount: w.quotedAmount ? w.quotedAmount.toFixed(2) : null,
          customerName: w.customer.name, siteName: w.serviceLocation?.name ?? null,
          convertedJobId: w.convertedJobId, requestedBy: w.requestedBy,
        }))}
      />
    </div>
  )
}
