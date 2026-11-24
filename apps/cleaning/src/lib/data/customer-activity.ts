import { orgDb } from "../org-db"

// Customer 360 — a read-only aggregation that makes every related record of an
// account directly reachable from the customer workspace. It queries existing
// models through their customer/site relations; it creates nothing.
export async function getCustomerAccountActivity(orgId: string, customerId: string) {
  const db = orgDb(orgId)
  const bySite = { serviceLocation: { customerId } }

  const [
    jobs, jobCount,
    plans,
    contracts, contractCount,
    estimates, estimateCount,
    inspections, inspectionCount,
    issues, issueCount,
    workOrders, workOrderCount,
  ] = await Promise.all([
    db.job.findMany({ where: bySite, orderBy: { scheduledStart: "desc" }, take: 5, select: { id: true, title: true, status: true, scheduledStart: true, serviceLocation: { select: { name: true } } } }),
    db.job.count({ where: bySite }),
    db.servicePlan.findMany({ where: bySite, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, frequency: true, billingType: true, isActive: true, serviceLocation: { select: { id: true, name: true } } } }),
    db.contract.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, contractValue: true } }),
    db.contract.count({ where: { customerId } }),
    db.estimate.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true } }),
    db.estimate.count({ where: { customerId } }),
    db.inspection.findMany({ where: bySite, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, templateName: true, status: true, outcome: true, createdAt: true } }),
    db.inspection.count({ where: bySite }),
    db.issue.findMany({ where: bySite, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, description: true, status: true, createdAt: true } }),
    db.issue.count({ where: bySite }),
    db.workOrder.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, description: true, status: true, type: true } }),
    db.workOrder.count({ where: { customerId } }),
  ])

  return {
    jobs: { count: jobCount, items: jobs },
    plans,
    contracts: { count: contractCount, items: contracts },
    estimates: { count: estimateCount, items: estimates },
    inspections: { count: inspectionCount, items: inspections },
    issues: { count: issueCount, items: issues },
    workOrders: { count: workOrderCount, items: workOrders },
  }
}

export type CustomerActivity = Awaited<ReturnType<typeof getCustomerAccountActivity>>
