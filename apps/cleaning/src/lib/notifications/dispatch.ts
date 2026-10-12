import { orgDb, systemDb } from "../org-db"
import { resolveCapabilities, parseOverrides, type PackageTier } from "../entitlements"
import { sendEmail, isEmailConfigured } from "../email"
import { sendSms, isSmsConfigured } from "../sms"

// Capability check without the server-only page-guards import, so dispatch stays
// importable from scripts/tests. Pure resolver over the org's tier + overrides.
async function orgHasNotifications(orgId: string): Promise<boolean> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { packageTier: true, capabilityOverrides: true } })
  if (!org) return false
  return resolveCapabilities({ packageTier: org.packageTier as PackageTier, capabilityOverrides: parseOverrides(org.capabilityOverrides) }).has("workforce.notifications")
}

// Central notification dispatch (Phase 21). Resolves each recipient's per-event
// channel preference, honors SMS opt-out, rate-limits per recipient/channel/
// event, sends via email/SMS, and records every attempt (incl. skips) to
// NotificationLog. Fire-and-forget at call sites — never blocks the request.

export type NotificationEventKey =
  | "JOB_ASSIGNED" | "ASSIGNMENT_CHANGED" | "SCHEDULE_CHANGED" | "SHIFT_UNCOVERED"
  | "TIMEOFF_APPROVED" | "TIMEOFF_DECLINED" | "MISSED_CLOCK_IN" | "CREDENTIAL_EXPIRING"
  | "VISIT_REMINDER" | "SERVICE_SUMMARY" | "PAYMENT_REMINDER" | "CUSTOMER_MESSAGE"
  | "ISSUE_ASSIGNED" | "ISSUE_UNACKED" | "ISSUE_OVERDUE" | "ISSUE_ESCALATED"

export type NotifyMessage = { subject: string; body: string }

// Per recipient, per channel, per event. A bug can't text someone 50 times.
export const NOTIFY_RATE = { windowMs: 60 * 60 * 1000, max: 5 }

// Injectable transport so the behavior (preferences, opt-out, rate-limit,
// logging) is testable without hitting Resend/Twilio.
export type NotifyDeps = {
  sendEmail: typeof sendEmail
  isEmailConfigured: typeof isEmailConfigured
  sendSms: typeof sendSms
  isSmsConfigured: typeof isSmsConfigured
  now: () => number
}
const defaultDeps: NotifyDeps = { sendEmail, isEmailConfigured, sendSms, isSmsConfigured, now: () => Date.now() }

/** Pure channel resolution: default is email-on / SMS-off; a pref row overrides. */
export function resolveChannels(hasCapability: boolean, pref: { email: boolean; sms: boolean } | null): { email: boolean; sms: boolean } {
  const email = pref ? pref.email : true
  const sms = hasCapability && (pref ? pref.sms : false) // SMS is opt-in and needs the capability
  return { email, sms }
}

async function deliver(
  orgId: string, userId: string, channel: "EMAIL" | "SMS", event: NotificationEventKey,
  to: string, msg: NotifyMessage, deps: NotifyDeps,
) {
  const db = orgDb(orgId)
  const log = (status: "SENT" | "FAILED" | "SKIPPED", detail?: string, providerId?: string) =>
    db.notificationLog.create({ data: { organizationId: orgId, userId, channel, event, toAddress: to, subject: msg.subject, body: msg.body, status, detail, providerId } })

  // Rate limit per recipient/channel/event.
  const since = new Date(deps.now() - NOTIFY_RATE.windowMs)
  const recent = await db.notificationLog.count({ where: { userId, channel, event, status: "SENT", createdAt: { gt: since } } })
  if (recent >= NOTIFY_RATE.max) { await log("SKIPPED", "rate_limited"); return }

  if (channel === "EMAIL") {
    if (!deps.isEmailConfigured()) { await log("SKIPPED", "email_unconfigured"); return }
    const r = await deps.sendEmail({ to, subject: msg.subject, text: msg.body })
    await log(r.delivered ? "SENT" : "FAILED", r.error)
  } else {
    if (!deps.isSmsConfigured()) { await log("SKIPPED", "sms_unconfigured"); return }
    const r = await deps.sendSms({ to, body: msg.body })
    await log(r.delivered ? "SENT" : "FAILED", r.error, r.providerId)
  }
}

/** Notify a CUSTOMER by email (Phase 26). Customers aren't staff users — we send
 *  to the customer's email (or primary contact), and log it like any other. */
export async function notifyCustomer(orgId: string, customerId: string, event: NotificationEventKey, msg: NotifyMessage, deps: NotifyDeps = defaultDeps): Promise<void> {
  const db = orgDb(orgId)
  const c = await db.customer.findFirst({ where: { id: customerId }, select: { email: true, contacts: { where: { isPrimary: true }, select: { email: true }, take: 1 } } })
  const to = c?.email || c?.contacts[0]?.email || null
  const log = (status: "SENT" | "FAILED" | "SKIPPED", detail?: string, providerId?: string) =>
    db.notificationLog.create({ data: { organizationId: orgId, userId: null, channel: "EMAIL", event, toAddress: to ?? "(none)", subject: msg.subject, body: msg.body, status, detail, providerId } })
  if (!to) { await log("SKIPPED", "no_customer_email"); return }
  if (!deps.isEmailConfigured()) { await log("SKIPPED", "email_unconfigured"); return }
  const r = await deps.sendEmail({ to, subject: msg.subject, text: msg.body })
  await log(r.delivered ? "SENT" : "FAILED", r.error)
}

/** Notify a single user of an event across their chosen channels. */
export async function notifyUserEvent(orgId: string, userId: string, event: NotificationEventKey, msg: NotifyMessage, deps: NotifyDeps = defaultDeps): Promise<void> {
  const db = orgDb(orgId)
  const user = await db.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, email: true, phone: true, smsOptOut: true } })
  if (!user) return
  const [hasCap, pref] = await Promise.all([
    orgHasNotifications(orgId),
    db.notificationPreference.findFirst({ where: { userId, event } }),
  ])
  const ch = resolveChannels(hasCap, pref)
  if (ch.email && user.email) await deliver(orgId, user.id, "EMAIL", event, user.email, msg, deps)
  if (ch.sms && user.phone && !user.smsOptOut) await deliver(orgId, user.id, "SMS", event, user.phone, msg, deps)
}

/** Fire-and-forget single-user notify. */
export function notifyUserEventSafe(orgId: string, userId: string, event: NotificationEventKey, msg: NotifyMessage): void {
  void notifyUserEvent(orgId, userId, event, msg).catch(() => {})
}

/** Notify every active user in the given roles. */
export async function notifyRolesEvent(orgId: string, roles: string[], event: NotificationEventKey, msg: NotifyMessage, deps: NotifyDeps = defaultDeps): Promise<void> {
  const users = await orgDb(orgId).user.findMany({ where: { role: { in: roles as ("OWNER")[] }, isActive: true }, select: { id: true } })
  for (const u of users) await notifyUserEvent(orgId, u.id, event, msg, deps)
}

/** Notify every active OWNER/ADMIN/MANAGER (used for uncovered-shift etc.). */
export async function notifyManagersEvent(orgId: string, event: NotificationEventKey, msg: NotifyMessage, deps: NotifyDeps = defaultDeps): Promise<void> {
  return notifyRolesEvent(orgId, ["OWNER", "ADMIN", "MANAGER"], event, msg, deps)
}
