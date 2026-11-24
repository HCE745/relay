import { orgDb } from "../org-db"
import { DateTime } from "luxon"
import { getUser } from "./users"
import { listCleanerJobsInWindow, listCleanerTimeEntries } from "./field"
import { listCredentialsForUser } from "./credentials"
import { listUserHeldItems } from "./custody"
import { listUnavailability } from "./availability"
import { listTimeOff } from "./timeoff"
import { outstandingAcks } from "./sops"

// Individual employee profile — a single aggregation over existing workforce data.
// It creates NO new records; every section reuses the module that owns it, so the
// profile stays consistent with the rest of the app. Sensitive sections
// (compensation, performance) are fetched by the caller behind its own gate.
export async function getEmployeeProfile(orgId: string, userId: string) {
  const user = await getUser(orgId, userId)
  if (!user || user.role === "CLIENT") return null

  const db = orgDb(orgId)
  const now = DateTime.now()
  const windowStart = now.minus({ days: 30 }).toJSDate()
  const windowEnd = now.plus({ days: 30 }).toJSDate()

  const [jobs, timeEntries, credentials, held, unavailability, timeOff, outstandingSops, empSkills, onboarding] =
    await Promise.all([
      listCleanerJobsInWindow(orgId, userId, windowStart, windowEnd),
      listCleanerTimeEntries(orgId, userId, 20),
      listCredentialsForUser(orgId, userId),
      listUserHeldItems(orgId, userId),
      listUnavailability(orgId, { userId }),
      listTimeOff(orgId, { userId }),
      outstandingAcks(orgId, userId, user.role),
      db.employeeSkill.findMany({ where: { userId }, select: { skillId: true } }),
      db.onboardingAssignment.findMany({
        where: { userId },
        orderBy: { assignedAt: "desc" },
        include: { tasks: { select: { status: true } } },
      }),
    ])

  const skills = empSkills.length
    ? await db.skill.findMany({ where: { id: { in: empSkills.map((e) => e.skillId) } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : []

  const nowJs = now.toJSDate()
  const upcoming = jobs.filter((j) => j.scheduledStart >= nowJs)
  const recent = jobs.filter((j) => j.scheduledStart < nowJs).reverse()

  return {
    user,
    jobs: { upcoming, recent },
    timeEntries,
    credentials,
    held,
    unavailability,
    timeOff,
    outstandingSops: outstandingSops.length,
    skills,
    onboarding: onboarding.map((a) => ({
      id: a.id,
      packetName: a.packetName,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      total: a.tasks.length,
      done: a.tasks.filter((t) => t.status === "COMPLETE").length,
    })),
  }
}

export type EmployeeProfileData = NonNullable<Awaited<ReturnType<typeof getEmployeeProfile>>>
