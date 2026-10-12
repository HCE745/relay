// Phase 30 integration verification: issue ownership, deadlines & escalation.
//  - a new issue derives severity (from category) + ack/resolve deadlines
//  - reassignment is tracked with a reason (audit)
//  - RESOLVER ≠ VERIFIER is enforced (can't verify your own fix); a different
//    person can, which closes it
//  - reopen gives a fresh deadline, bumps the count, keeps history
//  - the escalation cron advances the chain on overdue issues, idempotently
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase30-escalation.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { reportProblem, assignIssue, setIssueStatus, verifyIssue, getIssue } from "../src/lib/data/issues"
import { runIssueEscalation } from "../src/lib/data/issue-escalation"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }
const auditCount = (orgId: string, id: string, action: string) => systemDb.auditEvent.count({ where: { organizationId: orgId, entityType: "Issue", entityId: id, action } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Esc Co", slug: `es-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC", issueEscalationEnabled: true } })
  const owner = await systemDb.user.create({ data: { organizationId: org.id, name: "Owner", email: `o-${stamp}@t.co`, password: "x", role: "OWNER" } })
  const sup = await systemDb.user.create({ data: { organizationId: org.id, name: "Sup", email: `s-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const resolver = await systemDb.user.create({ data: { organizationId: org.id, name: "Rex Resolver", email: `r-${stamp}@t.co`, password: "x", role: "CLEANER", managerId: sup.id } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Clean", status: "COMPLETED", scheduledStart: new Date(), plannedStart: new Date() }, select: { id: true } })

  console.log("Severity + deadlines on report:")
  const safety = await reportProblem(org.id, job.id, resolver.id, { category: "SAFETY", description: "Wet floor, no sign" })
  check("SAFETY → CRITICAL severity", safety.severity === "CRITICAL")
  check("deadlines derived (ack + resolve set, ack before resolve)", !!safety.ackDeadline && !!safety.resolveDeadline && safety.ackDeadline < safety.resolveDeadline)

  console.log("\nReassignment with reason (audited):")
  await assignIssue(org.id, safety.id, owner.id, resolver.id)
  await assignIssue(org.id, safety.id, owner.id, sup.id, "Rex is off today")
  check("reassign recorded with reason", (await auditCount(org.id, safety.id, "reassign")) === 1)
  // Put it back to the resolver for the verify test.
  await assignIssue(org.id, safety.id, owner.id, resolver.id, "back to Rex")

  console.log("\nResolver ≠ Verifier:")
  await setIssueStatus(org.id, safety.id, resolver.id, "ACKNOWLEDGED")
  await setIssueStatus(org.id, safety.id, resolver.id, "RESOLVED")
  check("resolver can't verify their own fix", (await threw(() => verifyIssue(org.id, safety.id, resolver.id))) !== null)
  check("CLOSED can't be set via plain status change", (await threw(() => setIssueStatus(org.id, safety.id, owner.id, "CLOSED"))) !== null)
  await verifyIssue(org.id, safety.id, sup.id)
  const closed = await getIssue(org.id, safety.id)
  check("a different person verifies → CLOSED with verifier recorded", closed?.status === "CLOSED" && closed?.verifier?.id === sup.id)

  console.log("\nReopen → fresh deadline, kept history, bumped count:")
  const before = closed!.resolveDeadline
  await setIssueStatus(org.id, safety.id, owner.id, "OPEN")
  const reopened = await getIssue(org.id, safety.id)
  check("reopen count bumped + status OPEN", reopened?.reopenCount === 1 && reopened?.status === "OPEN")
  check("fresh resolve deadline (later than the old one)", !!reopened?.resolveDeadline && !!before && reopened!.resolveDeadline > before)
  check("history kept (reopen + verify audits both present)", (await auditCount(org.id, safety.id, "reopen")) === 1 && (await auditCount(org.id, safety.id, "verify")) === 1)

  console.log("\nEscalation cron advances the chain on overdue issues (idempotent):")
  const overdue = await reportProblem(org.id, job.id, resolver.id, { category: "EQUIPMENT", description: "Vacuum down" })
  await assignIssue(org.id, overdue.id, owner.id, resolver.id)
  // Force it overdue.
  await systemDb.issue.updateMany({ where: { id: overdue.id }, data: { ackDeadline: new Date(Date.now() - 3600_000), resolveDeadline: new Date(Date.now() - 3600_000) } })
  const r1 = await runIssueEscalation(org.id)
  const afterL1 = await getIssue(org.id, overdue.id)
  check("first run escalates to level 1", r1.escalated >= 1 && afterL1?.escalationLevel === 1)
  const r2 = await runIssueEscalation(org.id)
  const afterL2 = await getIssue(org.id, overdue.id)
  check("second run advances to level 2 (one step per run)", afterL2?.escalationLevel === 2)
  check("escalation audits recorded", (await auditCount(org.id, overdue.id, "escalate")) === 2)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL ESCALATION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
