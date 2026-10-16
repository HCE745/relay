import { orgDb } from "../org-db"
import { getOrgTimezone, getCommsConfig } from "./org"
import { claimAlert } from "./exceptions"
import { notifyCustomer } from "../notifications/dispatch"
import { formatTimeInZone } from "../scheduling/time"
import { DateTime } from "luxon"

// Customer communications (Phase 26). All route through notifyCustomer → email +
// NotificationLog. Each is idempotent per entity via claimAlert, so crons and
// completion hooks never double-send.

/** Service completion summary — fired (best-effort) when a job completes. */
export async function sendServiceSummary(orgId: string, jobId: string): Promise<void> {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId, status: "COMPLETED" },
    select: {
      id: true, title: true, actualEnd: true, scheduledStart: true,
      serviceLocation: { select: { name: true, timezone: true, customer: { select: { id: true, name: true, serviceSummariesOptIn: true } } } },
      assignments: { select: { user: { select: { name: true } } } },
      checklistItems: { select: { isComplete: true } },
      _count: { select: { photos: true } },
    },
  })
  if (!job || !job.serviceLocation.customer.serviceSummariesOptIn) return
  if (!(await claimAlert(orgId, "SERVICE_SUMMARY", jobId))) return

  const tz = job.serviceLocation.timezone ?? (await getOrgTimezone(orgId))
  const when = job.actualEnd ?? job.scheduledStart
  const done = job.checklistItems.filter((i) => i.isComplete).length
  const crew = [...new Set(job.assignments.map((a) => a.user.name))].join(", ") || "our team"
  const body = [
    `Your cleaning at ${job.serviceLocation.name} is complete.`,
    ``,
    `Service: ${job.title}`,
    `Finished: ${DateTime.fromJSDate(when, { zone: tz }).toFormat("cccc, LLL d")} at ${formatTimeInZone(when, tz)}`,
    `Completed by: ${crew}`,
    job.checklistItems.length ? `Tasks completed: ${done} of ${job.checklistItems.length}` : ``,
    job._count.photos ? `${job._count.photos} proof photo(s) are available in your customer portal.` : ``,
    ``,
    `Thank you for your business.`,
  ].filter(Boolean).join("\n")

  await notifyCustomer(orgId, job.serviceLocation.customer.id, "SERVICE_SUMMARY", { subject: `Service complete: ${job.serviceLocation.name}`, body })
}

/** Fire-and-forget wrapper for the completion hook. */
export function sendServiceSummarySafe(orgId: string, jobId: string): void {
  void sendServiceSummary(orgId, jobId).catch(() => {})
}

/** Pre-visit reminders for opted-in customers, within the org lead window. */
export async function runVisitReminders(orgId: string, now: Date = new Date()): Promise<number> {
  const [tz, cfg] = await Promise.all([getOrgTimezone(orgId), getCommsConfig(orgId)])
  const windowEnd = new Date(now.getTime() + cfg.visitReminderLeadHours * 3600_000)
  const jobs = await orgDb(orgId).job.findMany({
    where: {
      status: { in: ["SCHEDULED", "ASSIGNED"] },
      scheduledStart: { gte: now, lte: windowEnd },
      serviceLocation: { customer: { visitRemindersOptIn: true } },
    },
    select: { id: true, title: true, scheduledStart: true, serviceLocation: { select: { name: true, timezone: true, customer: { select: { id: true } } } } },
  })
  let sent = 0
  for (const job of jobs) {
    if (!(await claimAlert(orgId, "VISIT_REMINDER", job.id))) continue
    const siteTz = job.serviceLocation.timezone ?? tz
    const body = `Reminder: your cleaning at ${job.serviceLocation.name} is scheduled for ${DateTime.fromJSDate(job.scheduledStart, { zone: siteTz }).toFormat("cccc, LLL d")} at ${formatTimeInZone(job.scheduledStart, siteTz)}.`
    await notifyCustomer(orgId, job.serviceLocation.customer.id, "VISIT_REMINDER", { subject: `Upcoming cleaning: ${job.serviceLocation.name}`, body })
    sent++
  }
  return sent
}

/** Late-payment reminders: one per invoice once it becomes overdue. */
export async function runPaymentReminders(orgId: string, now: Date = new Date()): Promise<number> {
  const cfg = await getCommsConfig(orgId)
  if (!cfg.paymentRemindersEnabled) return 0
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    select: { id: true, invoiceNumber: true, total: true, currency: true, customerId: true, payments: { select: { amount: true } } },
  })
  let sent = 0
  for (const inv of invoices) {
    const paid = inv.payments.reduce((a, p) => a.plus(p.amount), inv.total.minus(inv.total))
    const balance = inv.total.minus(paid)
    if (balance.lte(0)) continue
    if (!(await claimAlert(orgId, "PAYMENT_REMINDER", inv.id))) continue
    const body = `This is a friendly reminder that invoice #${inv.invoiceNumber} has a balance of ${balance.toFixed(2)} ${inv.currency} that is now past due. Please arrange payment at your earliest convenience.`
    await notifyCustomer(orgId, inv.customerId, "PAYMENT_REMINDER", { subject: `Payment reminder: invoice #${inv.invoiceNumber}`, body })
    sent++
  }
  return sent
}
