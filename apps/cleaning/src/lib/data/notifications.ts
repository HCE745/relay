import { orgDb, systemDb } from "../org-db"
import type { NotificationEventKey } from "../notifications/dispatch"

// User-configurable notification events (staff-facing). Customer events
// (VISIT_REMINDER etc.) are handled per-customer in Phase 26, not here.
export const STAFF_NOTIFICATION_EVENTS: { event: NotificationEventKey; label: string; roles: "all" | "managers" }[] = [
  { event: "JOB_ASSIGNED", label: "I'm assigned to a job", roles: "all" },
  { event: "ASSIGNMENT_CHANGED", label: "My assignment changes or is cancelled", roles: "all" },
  { event: "SCHEDULE_CHANGED", label: "A job of mine is rescheduled or cancelled", roles: "all" },
  { event: "TIMEOFF_APPROVED", label: "My time off is approved", roles: "all" },
  { event: "TIMEOFF_DECLINED", label: "My time off is declined", roles: "all" },
  { event: "SHIFT_UNCOVERED", label: "A shift is uncovered (managers)", roles: "managers" },
  { event: "MISSED_CLOCK_IN", label: "A cleaner misses a clock-in (supervisors/managers)", roles: "managers" },
  { event: "CREDENTIAL_EXPIRING", label: "A credential is expiring (managers)", roles: "managers" },
]

/** Current user's channel choices across all staff events (defaults applied). */
export async function getUserPrefs(orgId: string, userId: string) {
  const rows = await orgDb(orgId).notificationPreference.findMany({ where: { userId } })
  const byEvent = new Map(rows.map((r) => [r.event, r]))
  return STAFF_NOTIFICATION_EVENTS.map(({ event, label, roles }) => {
    const r = byEvent.get(event as "JOB_ASSIGNED")
    return { event, label, roles, email: r ? r.email : true, sms: r ? r.sms : false }
  })
}

export async function setUserPref(orgId: string, userId: string, event: NotificationEventKey, input: { email: boolean; sms: boolean }) {
  const existing = await orgDb(orgId).notificationPreference.findFirst({ where: { userId, event: event as "JOB_ASSIGNED" }, select: { id: true } })
  if (existing) {
    await orgDb(orgId).notificationPreference.updateMany({ where: { id: existing.id }, data: { email: input.email, sms: input.sms } })
  } else {
    await orgDb(orgId).notificationPreference.create({ data: { organizationId: orgId, userId, event: event as "JOB_ASSIGNED", email: input.email, sms: input.sms } })
  }
  return { ok: true }
}

const digits = (s: string) => s.replace(/\D/g, "")

/**
 * Apply an inbound STOP/START keyword to every user matching the phone number
 * (by last-10-digit match, provider-format agnostic). Cross-org by design —
 * an inbound SMS carries no tenant context. Returns the count updated.
 */
export async function applyInboundSmsKeyword(fromPhone: string, keyword: "stop" | "start"): Promise<number> {
  const target = digits(fromPhone).slice(-10)
  if (target.length < 10) return 0
  const users = await systemDb.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })
  const matches = users.filter((u) => digits(u.phone ?? "").slice(-10) === target)
  if (matches.length === 0) return 0
  await systemDb.user.updateMany({ where: { id: { in: matches.map((m) => m.id) } }, data: { smsOptOut: keyword === "stop" } })
  return matches.length
}
