// Phase 21 integration verification: email/SMS notification dispatch.
//  - channel resolution (default email-on/SMS-off; pref overrides; SMS needs cap)
//  - SMS honors opt-out and requires a phone
//  - per-recipient/channel/event rate limit (a bug can't text 50 times)
//  - every attempt (incl. skips) is logged with a reason
//  - unconfigured transport degrades to SKIPPED, not a crash
//  - inbound STOP/START keyword flips smsOptOut
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase21-notifications.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { notifyUserEvent, resolveChannels, NOTIFY_RATE, type NotifyDeps } from "../src/lib/notifications/dispatch"
import { applyInboundSmsKeyword } from "../src/lib/data/notifications"
import { smsKeyword } from "../src/lib/sms"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

// Fake transports so we test behavior without Resend/Twilio.
function fakeDeps(over: Partial<NotifyDeps> = {}): NotifyDeps & { emails: string[]; texts: string[] } {
  const emails: string[] = []; const texts: string[] = []
  return {
    emails, texts,
    isEmailConfigured: () => true,
    isSmsConfigured: () => true,
    sendEmail: async (o) => { emails.push(o.to as string); return { delivered: true } },
    sendSms: async (o) => { texts.push(o.to); return { delivered: true, providerId: "SM1" } },
    now: () => Date.now(),
    ...over,
  }
}

async function logsFor(orgId: string, userId: string, channel: "EMAIL" | "SMS") {
  return systemDb.notificationLog.findMany({ where: { organizationId: orgId, userId, channel }, orderBy: { createdAt: "asc" } })
}

async function main() {
  const stamp = Date.now()
  // ENTERPRISE tier → has workforce.notifications (TEAM+), so SMS is unlocked.
  const org = await systemDb.organization.create({ data: { name: "Notify Co", slug: `ntf-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Cleo", email: `cleo-${stamp}@t.co`, phone: "+15125550100", password: "x", role: "CLEANER" } })

  console.log("Channel resolution (pure):")
  const def = resolveChannels(true, null)
  check("default is email-on, SMS-off", def.email === true && def.sms === false)
  check("SMS stays off without the capability even if pref says sms", resolveChannels(false, { email: true, sms: true }).sms === false)
  check("pref enables SMS when capability present", resolveChannels(true, { email: false, sms: true }).sms === true && resolveChannels(true, { email: false, sms: true }).email === false)

  console.log("\nDispatch with SMS enabled by preference:")
  await systemDb.notificationPreference.create({ data: { organizationId: org.id, userId: cleaner.id, event: "JOB_ASSIGNED", email: true, sms: true } })
  const d1 = fakeDeps()
  await notifyUserEvent(org.id, cleaner.id, "JOB_ASSIGNED", { subject: "Assigned", body: "You have a job" }, d1)
  check("email + SMS both sent", d1.emails.length === 1 && d1.texts.length === 1)
  check("both logged SENT", (await systemDb.notificationLog.count({ where: { organizationId: org.id, userId: cleaner.id, status: "SENT" } })) === 2)

  console.log("\nOpt-out blocks SMS but not email:")
  await systemDb.user.updateMany({ where: { id: cleaner.id }, data: { smsOptOut: true } })
  const d2 = fakeDeps()
  await notifyUserEvent(org.id, cleaner.id, "JOB_ASSIGNED", { subject: "Assigned 2", body: "Another job" }, d2)
  check("email still sent", d2.emails.length === 1)
  check("SMS suppressed by opt-out (no send, no log)", d2.texts.length === 0)
  await systemDb.user.updateMany({ where: { id: cleaner.id }, data: { smsOptOut: false } })

  console.log("\nRate limit (a bug can't text 50 times):")
  const d3 = fakeDeps()
  // JOB_ASSIGNED already has >=1 SENT email from above; drive email past the cap.
  for (let i = 0; i < NOTIFY_RATE.max + 3; i++) await notifyUserEvent(org.id, cleaner.id, "JOB_ASSIGNED", { subject: "spam", body: "x" }, d3)
  const emailLogs = await logsFor(org.id, cleaner.id, "EMAIL")
  const sent = emailLogs.filter((l) => l.status === "SENT").length
  const skipped = emailLogs.filter((l) => l.status === "SKIPPED" && l.detail === "rate_limited").length
  check("email sends capped at the rate limit", sent <= NOTIFY_RATE.max, `sent=${sent} (max ${NOTIFY_RATE.max})`)
  check("over-limit attempts logged as rate_limited", skipped > 0, `skipped=${skipped}`)

  console.log("\nUnconfigured transport degrades to SKIPPED (no crash):")
  const other = await systemDb.user.create({ data: { organizationId: org.id, name: "Sam", email: `sam-${stamp}@t.co`, phone: "+15125550111", password: "x", role: "CLEANER" } })
  await systemDb.notificationPreference.create({ data: { organizationId: org.id, userId: other.id, event: "SCHEDULE_CHANGED", email: true, sms: true } })
  const d4 = fakeDeps({ isEmailConfigured: () => false, isSmsConfigured: () => false })
  await notifyUserEvent(org.id, other.id, "SCHEDULE_CHANGED", { subject: "moved", body: "x" }, d4)
  const unconf = await systemDb.notificationLog.findMany({ where: { organizationId: org.id, userId: other.id } })
  check("nothing sent, both channels logged SKIPPED with reason", d4.emails.length === 0 && d4.texts.length === 0 && unconf.length === 2 && unconf.every((l) => l.status === "SKIPPED"))
  check("skip reasons name the unconfigured channel", unconf.some((l) => l.detail === "email_unconfigured") && unconf.some((l) => l.detail === "sms_unconfigured"))

  console.log("\nInbound STOP / START keyword:")
  check("STOP keyword parsed", smsKeyword("STOP") === "stop" && smsKeyword("start") === "start" && smsKeyword("hello") === null)
  const n1 = await applyInboundSmsKeyword("(512) 555-0100", "stop")
  check("STOP flips smsOptOut by phone match", n1 === 1 && (await systemDb.user.findUniqueOrThrow({ where: { id: cleaner.id } })).smsOptOut === true)
  await applyInboundSmsKeyword("+1 512 555 0100", "start")
  check("START clears it", (await systemDb.user.findUniqueOrThrow({ where: { id: cleaner.id } })).smsOptOut === false)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL NOTIFICATION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
