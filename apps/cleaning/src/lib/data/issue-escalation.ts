import { orgDb, systemDb } from "../org-db"
import { recordAudit } from "./audit"
import { claimAlert } from "./exceptions"
import { notifyUserEvent, notifyManagersEvent, notifyRolesEvent } from "../notifications/dispatch"

// Issue escalation (Phase 30), run from the Phase 25 exception cron. Idempotent
// per (issue, step) via the ExceptionAlert ledger, so a step never re-fires.
// Chain: 0 assignee → 1 supervisor (assignee's manager) → 2 managers → 3 owners.

const MAX_LEVEL = 3

async function notifyLevel(orgId: string, level: number, assigneeManagerId: string | null, msg: { subject: string; body: string }) {
  if (level === 1 && assigneeManagerId) return notifyUserEvent(orgId, assigneeManagerId, "ISSUE_ESCALATED", msg)
  if (level <= 2) return notifyManagersEvent(orgId, "ISSUE_ESCALATED", msg)
  return notifyRolesEvent(orgId, ["OWNER", "ADMIN"], "ISSUE_ESCALATED", msg)
}

export async function runIssueEscalation(orgId: string, now: Date = new Date()): Promise<{ unassigned: number; overdue: number; escalated: number }> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { issueEscalationEnabled: true } })
  const escalationEnabled = org?.issueEscalationEnabled ?? true

  const issues = await orgDb(orgId).issue.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    select: {
      id: true, status: true, title: true, assignedToId: true, acknowledgedAt: true,
      ackDeadline: true, resolveDeadline: true, escalationLevel: true, createdAt: true,
      serviceLocation: { select: { name: true } },
      assignedTo: { select: { managerId: true } },
    },
    take: 1000,
  })

  let unassigned = 0, overdue = 0, escalated = 0
  for (const i of issues) {
    const where = `${i.title ?? "Issue"} at ${i.serviceLocation?.name ?? "a site"}`

    // Unassigned (older than ~10 min) → nudge managers to assign it, once.
    if (!i.assignedToId && now.getTime() - i.createdAt.getTime() > 10 * 60_000) {
      if (await claimAlert(orgId, "ISSUE_UNACKED", `unassigned:${i.id}`)) {
        await notifyManagersEvent(orgId, "ISSUE_UNACKED", { subject: "Unassigned issue needs an owner", body: `"${where}" has no owner. Assign it in the app.` })
        unassigned++
      }
    }

    const ackOverdue = i.status === "OPEN" && !i.acknowledgedAt && !!i.ackDeadline && now > i.ackDeadline
    const resolveOverdue = !!i.resolveDeadline && now > i.resolveDeadline
    if (!ackOverdue && !resolveOverdue) continue

    // First overdue notice to the assignee, once.
    if (i.assignedToId && (await claimAlert(orgId, "ISSUE_OVERDUE", `overdue:${i.id}`))) {
      await notifyUserEvent(orgId, i.assignedToId, "ISSUE_OVERDUE", { subject: "Your issue is overdue", body: `"${where}" has passed its deadline. Please acknowledge/resolve it.` })
      overdue++
    }

    // Advance the escalation chain one step per run while overdue.
    if (escalationEnabled && i.escalationLevel < MAX_LEVEL) {
      const next = i.escalationLevel + 1
      if (await claimAlert(orgId, "ISSUE_ESCALATED", `esc:${i.id}:${next}`)) {
        await orgDb(orgId).issue.updateMany({ where: { id: i.id }, data: { escalationLevel: next } })
        await recordAudit(orgId, i.assignedToId ?? "system", "Issue", i.id, "escalate", { newValue: String(next), metadata: { level: next } })
        await notifyLevel(orgId, next, i.assignedTo?.managerId ?? null, { subject: `Issue escalated (level ${next})`, body: `"${where}" is overdue and has been escalated. Please step in.` })
        escalated++
      }
    }
  }
  return { unassigned, overdue, escalated }
}
