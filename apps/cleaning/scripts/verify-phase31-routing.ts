// Phase 31 integration verification: issue routing rules.
//  - priority-ordered first-match assignment on creation from EVERY source
//  - default fallback when no rule matches; unassigned when no default
//  - dry-run preview returns the same decision without creating anything
//  - a matched rule pointing at an inactive user does not silently assign
//  - every routing decision is logged (AuditEvent "route")
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase31-routing.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { reportProblem, getIssue } from "../src/lib/data/issues"
import { reportPortalIssue } from "../src/lib/data/portal"
import { routeIssue, createRoutingRule } from "../src/lib/data/issue-routing"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
const routeAudits = (orgId: string, id: string) => systemDb.auditEvent.count({ where: { organizationId: orgId, entityType: "Issue", entityId: id, action: "route" } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Route Co", slug: `rt-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const admin = await systemDb.user.create({ data: { organizationId: org.id, name: "Admin", email: `a-${stamp}@t.co`, password: "x", role: "ADMIN" } })
  const safetyOfficer = await systemDb.user.create({ data: { organizationId: org.id, name: "Sam Safety", email: `sf-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const supplyLead = await systemDb.user.create({ data: { organizationId: org.id, name: "Sue Supply", email: `su-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const defaultOwner = await systemDb.user.create({ data: { organizationId: org.id, name: "Dana Default", email: `d-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const ghost = await systemDb.user.create({ data: { organizationId: org.id, name: "Gone Ghost", email: `g-${stamp}@t.co`, password: "x", role: "CLEANER", isActive: true } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const client = await systemDb.user.create({ data: { organizationId: org.id, name: "Client", email: `c-${stamp}@t.co`, password: "x", role: "CLIENT", customerId: cust.id } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Clean", status: "COMPLETED", scheduledStart: new Date(), plannedStart: new Date() }, select: { id: true } })

  // Rules: SAFETY → safetyOfficer (priority 10); SUPPLIES → supplyLead (20);
  // a high-priority but broken rule pointing at an inactive user (5) for QUALITY.
  await createRoutingRule(org.id, admin.id, { name: "Safety", priority: 10, isActive: true, category: "SAFETY", severity: null, source: null, serviceLocationId: null, assignToId: safetyOfficer.id })
  await createRoutingRule(org.id, admin.id, { name: "Supplies", priority: 20, isActive: true, category: "SUPPLIES", severity: null, source: null, serviceLocationId: null, assignToId: supplyLead.id })
  await createRoutingRule(org.id, admin.id, { name: "Quality (broken)", priority: 5, isActive: true, category: "QUALITY", severity: null, source: null, serviceLocationId: null, assignToId: ghost.id })
  await systemDb.organization.update({ where: { id: org.id }, data: { defaultIssueAssigneeId: defaultOwner.id } })
  // The rule's owner is deactivated AFTER the rule was created (a real stale-rule scenario).
  await systemDb.user.update({ where: { id: ghost.id }, data: { isActive: false } })

  console.log("First-match on creation (field report):")
  const safety = await reportProblem(org.id, job.id, admin.id, { category: "SAFETY", description: "Wet floor" })
  const safetyFull = await getIssue(org.id, safety.id)
  check("SAFETY routed to the safety officer", safetyFull?.assignedTo?.id === safetyOfficer.id)
  check("routing decision logged", (await routeAudits(org.id, safety.id)) === 1)

  const supplies = await reportProblem(org.id, job.id, admin.id, { category: "SUPPLIES", description: "Out of towels" })
  check("SUPPLIES routed to the supply lead", (await getIssue(org.id, supplies.id))?.assignedTo?.id === supplyLead.id)

  console.log("\nDefault fallback when no rule matches:")
  const access = await reportProblem(org.id, job.id, admin.id, { category: "ACCESS", description: "Lockbox jammed" })
  check("ACCESS (no rule) falls back to default owner", (await getIssue(org.id, access.id))?.assignedTo?.id === defaultOwner.id)

  console.log("\nMatched rule → inactive user is NOT silently assigned:")
  const quality = await reportProblem(org.id, job.id, admin.id, { category: "QUALITY", description: "Streaky glass" })
  const qf = await getIssue(org.id, quality.id)
  check("QUALITY matched broken rule → left unassigned (not the ghost)", qf?.assignedTo == null)
  check("decision still logged for the broken-rule issue", (await routeAudits(org.id, quality.id)) === 1)

  console.log("\nRouting applies to the portal (customer) source too:")
  const portal = await reportPortalIssue(org.id, cust.id, client.id, { serviceLocationId: site.id, description: "Trash not emptied" })
  const pf = await getIssue(org.id, portal.id)
  check("portal issue (category CUSTOMER, no rule) → default owner", pf?.assignedTo?.id === defaultOwner.id)
  check("portal issue got SLA deadlines (Phase 30 gap fixed)", !!pf?.ackDeadline && !!pf?.resolveDeadline)

  console.log("\nDry-run preview matches live behavior and creates nothing:")
  const beforeCount = await systemDb.issue.count({ where: { organizationId: org.id } })
  const preview = await routeIssue(org.id, { category: "SAFETY", severity: "CRITICAL", source: "STAFF", serviceLocationId: site.id })
  check("preview → safety officer, reason 'rule'", preview.assignToId === safetyOfficer.id && preview.reason === "rule")
  const previewDefault = await routeIssue(org.id, { category: "OTHER", severity: "LOW", source: "STAFF", serviceLocationId: null })
  check("preview no-match → default owner, reason 'default'", previewDefault.assignToId === defaultOwner.id && previewDefault.reason === "default")
  check("preview created no issues", (await systemDb.issue.count({ where: { organizationId: org.id } })) === beforeCount)

  console.log("\nNo default + no rule → stays unassigned:")
  await systemDb.organization.update({ where: { id: org.id }, data: { defaultIssueAssigneeId: null } })
  const orphan = await reportProblem(org.id, job.id, admin.id, { category: "OTHER", description: "Misc" })
  check("unmatched issue with no default is unassigned", (await getIssue(org.id, orphan.id))?.assignedTo == null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL ROUTING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
