// Phase 33 integration verification: issue resolution dashboard stats.
// Seeds issues in known states and asserts the aggregation the dashboard shows.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase33-dashboard.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { getIssueResolutionStats } from "../src/lib/data/issue-dashboard"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
const H = 3_600_000, DAY = 86_400_000

async function main() {
  const now = new Date()
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Dash Co", slug: `ds-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const owner = await systemDb.user.create({ data: { organizationId: org.id, name: "Olivia Owner", email: `o-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const reporter = await systemDb.user.create({ data: { organizationId: org.id, name: "Rep", email: `r-${stamp}@t.co`, password: "x", role: "CLEANER" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust.id, name: "HQ" } })
  const base = { organizationId: org.id, reportedById: reporter.id, serviceLocationId: site.id, description: "x" }

  // 3 open/ack: 1 unassigned, 1 assigned+overdue+escalated, 1 ack assigned.
  await systemDb.issue.create({ data: { ...base, status: "OPEN", category: "SUPPLIES", severity: "LOW" } })
  await systemDb.issue.create({ data: { ...base, status: "OPEN", category: "SAFETY", severity: "CRITICAL", assignedToId: owner.id, escalationLevel: 2, resolveDeadline: new Date(now.getTime() - 2 * H) } })
  await systemDb.issue.create({ data: { ...base, status: "ACKNOWLEDGED", category: "QUALITY", severity: "HIGH", assignedToId: owner.id, resolveDeadline: new Date(now.getTime() + 5 * H) } })
  // 1 resolved (awaiting verification).
  await systemDb.issue.create({ data: { ...base, status: "RESOLVED", category: "QUALITY", severity: "MEDIUM", assignedToId: owner.id, resolvedAt: new Date(now.getTime() - 1 * H) } })
  // 2 closed in last 7d: one on-time (resolved before deadline), one late.
  await systemDb.issue.create({ data: { ...base, status: "CLOSED", category: "QUALITY", severity: "MEDIUM",
    createdAt: new Date(now.getTime() - 2 * DAY), resolvedAt: new Date(now.getTime() - 2 * DAY + 4 * H), closedAt: new Date(now.getTime() - 2 * DAY + 6 * H), resolveDeadline: new Date(now.getTime() - 2 * DAY + 8 * H) } })
  await systemDb.issue.create({ data: { ...base, status: "CLOSED", category: "EQUIPMENT", severity: "HIGH",
    createdAt: new Date(now.getTime() - 3 * DAY), resolvedAt: new Date(now.getTime() - 3 * DAY + 30 * H), closedAt: new Date(now.getTime() - 3 * DAY + 31 * H), resolveDeadline: new Date(now.getTime() - 3 * DAY + 8 * H) } })
  // 1 open that was reopened once.
  await systemDb.issue.create({ data: { ...base, status: "OPEN", category: "OTHER", severity: "LOW", reopenCount: 1 } })

  const s = await getIssueResolutionStats(org.id, now)

  console.log("Tile counts:")
  check("open (OPEN+ACK) = 4", s.tiles.open === 4, String(s.tiles.open))
  check("unassigned = 2", s.tiles.unassigned === 2, String(s.tiles.unassigned))
  check("overdue = 1", s.tiles.overdue === 1, String(s.tiles.overdue))
  check("escalated = 1", s.tiles.escalated === 1, String(s.tiles.escalated))
  check("awaiting verification = 1", s.tiles.awaitingVerification === 1, String(s.tiles.awaitingVerification))
  check("closed (7d) = 2", s.tiles.closed7 === 2, String(s.tiles.closed7))

  console.log("\nTiming + SLA (last 30d closed):")
  check("closed count = 2", s.timing.closedCount === 2)
  check("SLA on-time = 50% (1 of 2)", s.timing.slaCompliancePct === 50, String(s.timing.slaCompliancePct))
  check("median resolve hours ≈ (4 + 30)/2 = 17", s.timing.medianResolveHrs === 17, String(s.timing.medianResolveHrs))
  check("reopened (open) = 1", s.timing.reopenedOpen === 1, String(s.timing.reopenedOpen))

  console.log("\nBreakdowns:")
  const sev = Object.fromEntries(s.bySeverity.map((r) => [r.key, r.count]))
  check("open by severity: CRITICAL 1, HIGH 1, LOW 2", sev.CRITICAL === 1 && sev.HIGH === 1 && sev.LOW === 2, JSON.stringify(sev))
  check("open by owner: Olivia has 2", s.byOwner.find((o) => o.name === "Olivia Owner")?.count === 2)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL DASHBOARD CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
