import { orgDb } from "../org-db"
import { DateTime } from "luxon"

// Supervisor scoping (Phase 52). A supervisor is responsible for a set of sites
// (ServiceLocation.supervisorId) and a crew (EmployeeProfile.supervisorId). Their
// experience is centred on those; these queries never reach unrelated teams.

export async function getSupervisorScope(orgId: string, supervisorId: string) {
  const db = orgDb(orgId)
  const [sites, crew] = await Promise.all([
    db.serviceLocation.findMany({ where: { supervisorId }, select: { id: true } }),
    db.employeeProfile.findMany({ where: { supervisorId }, select: { userId: true } }),
  ])
  return { siteIds: sites.map((s) => s.id), crewIds: crew.map((c) => c.userId) }
}

export async function getSupervisorDashboard(orgId: string, supervisorId: string) {
  const db = orgDb(orgId)
  const { siteIds, crewIds } = await getSupervisorScope(orgId, supervisorId)
  const now = new Date()
  const weekEnd = DateTime.now().plus({ days: 7 }).toJSDate()

  const noScope = siteIds.length === 0 && crewIds.length === 0
  if (noScope) return { sites: [], crew: [], openIssues: [], upcomingJobs: [], inspections: [], corrective: [], supplyRequests: [], empty: true }

  const [sites, crew, openIssues, upcomingJobs, inspections, corrective, supplyRequests] = await Promise.all([
    db.serviceLocation.findMany({ where: { supervisorId }, orderBy: { name: "asc" }, select: { id: true, name: true, customer: { select: { id: true, name: true } }, isActive: true } }),
    db.user.findMany({ where: { employeeProfile: { supervisorId } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, isActive: true } }),
    db.issue.findMany({
      where: { serviceLocationId: { in: siteIds }, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, description: true, status: true, severity: true, serviceLocation: { select: { name: true } } },
    }),
    db.job.findMany({
      where: { serviceLocationId: { in: siteIds }, status: { notIn: ["CANCELLED", "COMPLETED"] }, scheduledStart: { gte: now, lte: weekEnd } },
      orderBy: { scheduledStart: "asc" }, take: 30,
      select: { id: true, title: true, scheduledStart: true, status: true, serviceLocation: { select: { name: true, timezone: true, customer: { select: { name: true } } } }, assignments: { select: { user: { select: { name: true } } } } },
    }),
    db.inspection.findMany({
      where: { serviceLocationId: { in: siteIds } },
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, templateName: true, status: true, outcome: true, score: true, createdAt: true, serviceLocation: { select: { name: true } } },
    }),
    db.workOrder.findMany({
      where: { serviceLocationId: { in: siteIds }, status: { notIn: ["COMPLETED", "DECLINED", "VERIFIED"] } },
      orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, description: true, status: true, priority: true, serviceLocation: { select: { name: true } } },
    }),
    db.replenishmentRequest.findMany({
      where: { status: { in: ["OPEN", "APPROVED"] }, OR: [{ requestedById: { in: crewIds.length ? crewIds : ["_none_"] } }, { inventoryLocation: { serviceLocationId: { in: siteIds.length ? siteIds : ["_none_"] } } }] },
      orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, note: true, quantity: true, status: true, supply: { select: { name: true } }, requestedBy: { select: { name: true } } },
    }),
  ])

  return { sites, crew, openIssues, upcomingJobs, inspections, corrective, supplyRequests, empty: false }
}

export async function assignSiteSupervisor(orgId: string, siteId: string, supervisorId: string | null) {
  if (supervisorId) {
    const u = await orgDb(orgId).user.findFirst({ where: { id: supervisorId, isActive: true, role: { in: ["SUPERVISOR", "MANAGER", "ADMIN", "OWNER"] } }, select: { id: true } })
    if (!u) return null
  }
  const { count } = await orgDb(orgId).serviceLocation.updateMany({ where: { id: siteId }, data: { supervisorId } })
  return count > 0
}

export async function assignEmployeeSupervisor(orgId: string, userId: string, supervisorId: string | null) {
  if (supervisorId) {
    const u = await orgDb(orgId).user.findFirst({ where: { id: supervisorId, isActive: true, role: { in: ["SUPERVISOR", "MANAGER", "ADMIN", "OWNER"] } }, select: { id: true } })
    if (!u) return null
  }
  const { count } = await orgDb(orgId).employeeProfile.updateMany({ where: { userId }, data: { supervisorId } })
  if (count === 0) {
    // No profile row yet — create a minimal one carrying the assignment.
    await orgDb(orgId).employeeProfile.create({ data: { organizationId: orgId, userId, supervisorId } })
  }
  return true
}

/** Supervisors for assignment pickers. */
export function listSupervisors(orgId: string) {
  return orgDb(orgId).user.findMany({
    where: { isActive: true, role: { in: ["SUPERVISOR", "MANAGER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  })
}
