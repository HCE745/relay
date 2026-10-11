import { orgDb, isUniqueViolation } from "../org-db"
import { getAlertConfig } from "./org"
import { listUncoveredShifts } from "./coverage"
import { listExpiringCredentials } from "./credentials"
import { notifyManagersEvent, notifyRolesEvent, type NotificationEventKey } from "../notifications/dispatch"

// Operational exception detection + push alerting (Phase 25). Runs from a cron.
// Each (event, entity) alerts AT MOST ONCE, guarded by ExceptionAlert — a
// re-detection on the next run does not re-notify. Delivery routes through the
// Phase 21 system (per-user channel prefs, opt-out, degrade when unconfigured).

/** Claim an alert for (event, entityId). Returns true the FIRST time only.
 *  Shared idempotency guard — also used by customer comms (Phase 26). */
export async function claimAlert(orgId: string, event: NotificationEventKey, entityId: string): Promise<boolean> {
  return claim(orgId, event, entityId)
}
async function claim(orgId: string, event: NotificationEventKey, entityId: string): Promise<boolean> {
  try {
    await orgDb(orgId).exceptionAlert.create({ data: { organizationId: orgId, event: event as "SHIFT_UNCOVERED", entityId } })
    return true
  } catch (e) {
    if (isUniqueViolation(e)) return false
    throw e
  }
}

export async function runExceptionAlerts(orgId: string, now: Date = new Date()): Promise<{ uncovered: number; missed: number; credentials: number }> {
  const cfg = await getAlertConfig(orgId)
  let uncovered = 0, missed = 0, credentials = 0

  // 1) Uncovered shifts within the lead window → managers.
  for (const shift of await listUncoveredShifts(orgId, { hoursAhead: cfg.uncoveredAlertLeadHours, now })) {
    if (!(await claim(orgId, "SHIFT_UNCOVERED", shift.jobId))) continue
    await notifyManagersEvent(orgId, "SHIFT_UNCOVERED", {
      subject: "Uncovered shift needs coverage",
      body: `"${shift.title}" at ${shift.siteName} (${shift.customerName}) has no available cleaner. Assign coverage in the app.`,
    })
    uncovered++
  }

  // 2) Missed clock-in: a job past its start with NOBODY clocked in → supervisor + managers.
  const graceCutoff = new Date(now.getTime() - cfg.missedClockInGraceMin * 60_000)
  const stale = await orgDb(orgId).job.findMany({
    where: { status: { in: ["SCHEDULED", "ASSIGNED"] }, scheduledStart: { lt: graceCutoff }, timeEntries: { none: {} } },
    select: { id: true, title: true, scheduledStart: true, serviceLocation: { select: { name: true } } },
    take: 500,
  })
  for (const job of stale) {
    if (!(await claim(orgId, "MISSED_CLOCK_IN", job.id))) continue
    await notifyRolesEvent(orgId, ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"], "MISSED_CLOCK_IN", {
      subject: "Missed clock-in",
      body: `No one has clocked in for "${job.title}" at ${job.serviceLocation.name} (was due to start earlier). Please check on it.`,
    })
    missed++
  }

  // 3) Expiring / expired credentials → managers.
  for (const c of await listExpiringCredentials(orgId, cfg.credentialLeadDays, now)) {
    if (!(await claim(orgId, "CREDENTIAL_EXPIRING", c.id))) continue
    await notifyManagersEvent(orgId, "CREDENTIAL_EXPIRING", {
      subject: `Credential ${c.state === "EXPIRED" ? "expired" : "expiring"}`,
      body: `${c.user.name}'s ${c.type} is ${c.state === "EXPIRED" ? "expired" : "expiring soon"}. Update it to keep assignments compliant.`,
    })
    credentials++
  }

  return { uncovered, missed, credentials }
}
