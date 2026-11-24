import { orgDb } from "../org-db"

// Service-location (site) workspace activity — makes a site's operational records
// reachable from the site page. Read-only aggregation over existing models.
export async function getSiteActivity(orgId: string, siteId: string) {
  const db = orgDb(orgId)
  const w = { serviceLocationId: siteId }
  const [jobs, jobCount, issues, issueCount, workOrders, workOrderCount] = await Promise.all([
    db.job.findMany({ where: w, orderBy: { scheduledStart: "desc" }, take: 6, select: { id: true, title: true, status: true, scheduledStart: true } }),
    db.job.count({ where: w }),
    db.issue.findMany({ where: w, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, title: true, description: true, status: true, createdAt: true } }),
    db.issue.count({ where: w }),
    db.workOrder.findMany({ where: w, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, description: true, status: true } }),
    db.workOrder.count({ where: w }),
  ])
  return {
    jobs: { count: jobCount, items: jobs },
    issues: { count: issueCount, items: issues },
    workOrders: { count: workOrderCount, items: workOrders },
  }
}

export type SiteActivity = Awaited<ReturnType<typeof getSiteActivity>>
