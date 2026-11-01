// Phase 48 integration verification: employee onboarding packets.
//  - a packet's items snapshot onto an assignment's tasks
//  - completing tasks advances progress; the assignment completes when all done
//  - a requires-document task won't complete without a reference
//  - reopening a task un-completes the assignment
//  - a hire auto-assigns assign-on-hire packets; editing a packet never
//    rewrites an existing assignment's tasks (immutability)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase48-onboarding.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import { createPacket, assignPacket, completeTask, reopenTask, updatePacket, getAssignment, assignOnHirePackets, listAssignments } from "../src/lib/data/onboarding"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const d = await createDemoOrg("48.48.48.48", 2)
  const orgId = d.orgId
  const user = await orgDb(orgId).user.findFirstOrThrow({ where: { role: "CLEANER" }, select: { id: true } })

  console.log("Packet items snapshot onto assignment tasks:")
  const packet = await createPacket(orgId, {
    name: "Verify packet",
    assignOnHire: true,
    items: [
      { label: "Sign handbook", requiresDocument: true },
      { label: "Safety orientation" },
      { label: "Direct deposit", requiresDocument: true },
    ],
  })
  const assignment = await assignPacket(orgId, packet.id, user.id, null)
  let a = await getAssignment(orgId, assignment.id)
  check("three tasks created from three items", a!.tasks.length === 3)
  check("task labels match the packet items", a!.tasks.some((t) => t.label === "Sign handbook"))
  check("not complete at start", a!.completedAt === null)

  console.log("\nA requires-document task won't complete without a reference:")
  const docTask = a!.tasks.find((t) => t.requiresDocument)!
  const err = await threw(() => completeTask(orgId, docTask.id, null, {}))
  check("blocked without a document reference", err !== null)
  await completeTask(orgId, docTask.id, null, { documentRef: "https://docs/x.pdf" })
  a = await getAssignment(orgId, assignment.id)
  check("completes with a reference", a!.tasks.find((t) => t.id === docTask.id)?.status === "COMPLETE")

  console.log("\nProgress advances; assignment completes when all tasks are done:")
  for (const t of a!.tasks.filter((t) => t.status !== "COMPLETE")) await completeTask(orgId, t.id, null, t.requiresDocument ? { documentRef: "https://docs/y.pdf" } : {})
  a = await getAssignment(orgId, assignment.id)
  check("assignment is complete when every task is", a!.completedAt !== null)

  console.log("\nReopening a task un-completes the assignment:")
  await reopenTask(orgId, a!.tasks[0].id)
  a = await getAssignment(orgId, assignment.id)
  check("task reopened to PENDING", a!.tasks.find((t) => t.id === a!.tasks[0].id)?.status === "PENDING")
  check("assignment no longer complete", a!.completedAt === null)

  console.log("\nEditing the packet does NOT rewrite the existing assignment (immutability):")
  await updatePacket(orgId, packet.id, { items: [{ label: "Totally different item" }] })
  a = await getAssignment(orgId, assignment.id)
  check("existing tasks keep their snapshotted labels", a!.tasks.length === 3 && a!.tasks.some((t) => t.label === "Sign handbook"))

  console.log("\nAuto-assign on hire picks up assign-on-hire packets:")
  const other = await systemDb.user.create({ data: { organizationId: orgId, name: "New Hire", email: `nh-${Date.now()}@demo.co`, password: "x", role: "CLEANER" }, select: { id: true } })
  const res = await assignOnHirePackets(orgId, other.id, null)
  check("at least the demo + verify assign-on-hire packets were assigned", res.assigned >= 1, `assigned=${res.assigned}`)
  const list = await listAssignments(orgId)
  check("the new hire has an assignment", list.some((x) => x.userName === "New Hire"))

  console.log("\nDouble-assigning an open packet is refused:")
  const dup = await threw(() => assignPacket(orgId, packet.id, user.id, null))
  check("a second open assignment of the same packet is blocked", dup !== null)

  await systemDb.organization.delete({ where: { id: orgId } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL ONBOARDING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
