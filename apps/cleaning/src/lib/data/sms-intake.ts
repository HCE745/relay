import { orgDb, systemDb } from "../org-db"
import { recordAudit } from "./audit"
import { issueSlaFields } from "./issues"
import { applyRouting } from "./issue-routing"
import { claimOnce } from "./idempotency"
import { notifyManagers } from "../notify"

// SMS issue intake (Phase 35). An inbound text becomes an issue. We identify the
// sender by phone — employee, customer, or unknown — which also tells us the
// org (SMS is env-configured with one number per deployment). An UNKNOWN number
// is flagged, never rejected. Everything routes through the normal Phase 31
// rules (source "SMS"), reusing that facts matcher rather than forking one.

/** Last 10 digits — tolerant of +1, spaces, and punctuation. */
export function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").slice(-10)
}

export type SmsSender =
  | { kind: "employee"; orgId: string; userId: string; name: string }
  | { kind: "customer"; orgId: string; customerId: string; name: string }
  | { kind: "unknown" }

/**
 * Resolve an inbound number to a known employee or customer (and thereby its
 * org). A cheap last-4 prefilter keeps the candidate set tiny; the full
 * normalized compare confirms the match.
 */
export async function identifySmsSender(from: string): Promise<SmsSender> {
  const norm = normalizePhone(from)
  if (norm.length < 10) return { kind: "unknown" }
  const last4 = norm.slice(-4)

  const users = await systemDb.user.findMany({
    where: { isActive: true, phone: { contains: last4 } },
    select: { id: true, name: true, phone: true, organizationId: true },
    take: 200,
  })
  const u = users.find((x) => x.phone && normalizePhone(x.phone) === norm)
  if (u) return { kind: "employee", orgId: u.organizationId, userId: u.id, name: u.name }

  const customers = await systemDb.customer.findMany({
    where: { phone: { contains: last4 } },
    select: { id: true, name: true, phone: true, organizationId: true },
    take: 200,
  })
  const c = customers.find((x) => x.phone && normalizePhone(x.phone) === norm)
  if (c) return { kind: "customer", orgId: c.organizationId, customerId: c.id, name: c.name }

  return { kind: "unknown" }
}

export type SmsIntakeResult =
  | { filed: true; reference: string; sender: SmsSender["kind"] }
  | { filed: false; reason: "no_org" | "duplicate" }

/**
 * File an inbound SMS as an issue. `fallbackOrgId` (from env) is the inbox for
 * UNKNOWN senders so they're flagged-not-rejected; without it, an unknown
 * number on a multi-org deployment can't be attributed and isn't filed.
 * `messageSid` (Twilio's id) dedupes retries via the shared claimOnce ledger.
 */
export async function intakeSmsIssue(input: { from: string; body: string; messageSid?: string }, fallbackOrgId?: string | null): Promise<SmsIntakeResult> {
  const sender = await identifySmsSender(input.from)
  const orgId = sender.kind === "unknown" ? (fallbackOrgId ?? null) : sender.orgId
  if (!orgId) return { filed: false, reason: "no_org" }

  // Dedupe Twilio retries once the org is known — only the first delivery files.
  if (input.messageSid && !(await claimOnce(orgId, "inbound-sms", input.messageSid))) {
    return { filed: false, reason: "duplicate" }
  }

  const db = orgDb(orgId)
  const category = "OTHER"
  const sla = await issueSlaFields(orgId, category)
  const external =
    sender.kind === "employee" ? null
    : sender.kind === "customer" ? `${sender.name} · ${input.from}`
    : `Unknown sender · ${input.from}`

  const issue = await db.issue.create({
    data: {
      organizationId: orgId,
      source: "SMS",
      category,
      severity: sla.severity,
      ackDeadline: sla.ackDeadline,
      resolveDeadline: sla.resolveDeadline,
      description: input.body.trim().slice(0, 2000) || "(no message)",
      reportedById: sender.kind === "employee" ? sender.userId : null,
      externalReporter: external,
      status: "OPEN",
    },
    select: { id: true },
  })
  await recordAudit(orgId, sender.kind === "employee" ? sender.userId : null, "Issue", issue.id, "report", { metadata: { source: "SMS", sender: sender.kind } })
  await applyRouting(orgId, issue.id, sender.kind === "employee" ? sender.userId : null, { category, severity: sla.severity, source: "SMS", serviceLocationId: null })
  await notifyManagers(orgId, "New SMS-reported problem", `A problem was reported by text (${sender.kind}). Open Issues to triage.`)
  return { filed: true, reference: issue.id.slice(-6).toUpperCase(), sender: sender.kind }
}
