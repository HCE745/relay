import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendPushNotification } from "@/lib/push-notifications"

export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  conditions: {
    priority?: string[]
    category?: string[]
    locationIds?: string[]
    departmentIds?: string[]
  }
  recipients: {
    roles?: string[]
    userIds?: string[]
    recipientDepartmentIds?: string[]  // all active members of these departments
    includeAssignee?: boolean           // always include the issue's assigned user
  }
  channels: {
    inApp: boolean
    email: boolean
    push: boolean
  }
}

export function parseNotificationRules(raw: unknown): NotificationRule[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((r): r is NotificationRule =>
    r && typeof r === "object" &&
    typeof r.id === "string" &&
    typeof r.name === "string"
  )
}

interface IssueContext {
  id: string
  title: string
  priority: string
  category: string
  locationId: string | null
  departmentId: string | null
  organizationId: string
  assignedToId?: string | null
}

function issueMatchesRule(issue: IssueContext, rule: NotificationRule): boolean {
  const c = rule.conditions
  if (c.priority?.length && !c.priority.includes(issue.priority)) return false
  if (c.category?.length && !c.category.includes(issue.category)) return false
  if (c.locationIds?.length && (!issue.locationId || !c.locationIds.includes(issue.locationId))) return false
  if (c.departmentIds?.length && (!issue.departmentId || !c.departmentIds.includes(issue.departmentId))) return false
  return true
}

export async function dispatchNotificationRules(issue: IssueContext, rules: NotificationRule[]) {
  const enabledRules = rules.filter(r => r.enabled && issueMatchesRule(issue, r))
  if (!enabledRules.length) return

  // Collect recipient selectors across all matching rules
  const recipientRoles = new Set<string>()
  const recipientUserIds = new Set<string>()
  const recipientDeptIds = new Set<string>()
  let includeAssignee = false

  for (const rule of enabledRules) {
    rule.recipients.roles?.forEach(r => recipientRoles.add(r))
    rule.recipients.userIds?.forEach(id => recipientUserIds.add(id))
    rule.recipients.recipientDepartmentIds?.forEach(id => recipientDeptIds.add(id))
    if (rule.recipients.includeAssignee) includeAssignee = true
  }

  if (includeAssignee && issue.assignedToId) {
    recipientUserIds.add(issue.assignedToId)
  }

  // Load users by role
  const roleUsers = recipientRoles.size > 0
    ? await prisma.user.findMany({
        where: {
          organizationId: issue.organizationId,
          isActive: true,
          role: { in: Array.from(recipientRoles) },
        },
        select: { id: true, name: true, email: true },
      })
    : []

  // Load users in recipient departments
  const deptUsers = recipientDeptIds.size > 0
    ? await prisma.user.findMany({
        where: {
          organizationId: issue.organizationId,
          isActive: true,
          departmentId: { in: Array.from(recipientDeptIds) },
        },
        select: { id: true, name: true, email: true },
      })
    : []

  // Load specific users (includes assignee if applicable)
  const specificUsers = recipientUserIds.size > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: Array.from(recipientUserIds) },
          organizationId: issue.organizationId,
          isActive: true,
        },
        select: { id: true, name: true, email: true },
      })
    : []

  // Merge and deduplicate
  const allUsersMap = new Map<string, { id: string; name: string; email: string }>()
  for (const u of [...roleUsers, ...deptUsers, ...specificUsers]) allUsersMap.set(u.id, u)
  const recipients = Array.from(allUsersMap.values())
  if (!recipients.length) return

  // Union channels across all matching rules
  const useInApp = enabledRules.some(r => r.channels.inApp)
  const useEmail  = enabledRules.some(r => r.channels.email)
  const usePush   = enabledRules.some(r => r.channels.push)

  const issueUrl  = `/issues/${issue.id}`
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const title     = `[${issue.priority}] ${issue.title}`
  const message   = `A ${issue.priority.toLowerCase()} priority issue was reported: "${issue.title}"`

  if (useInApp) {
    await prisma.notification.createMany({
      data: recipients.map(u => ({
        userId:         u.id,
        organizationId: issue.organizationId,
        issueId:        issue.id,
        type:           "ISSUE_ALERT",
        title,
        message,
      })),
      skipDuplicates: true,
    })
  }

  if (usePush) {
    for (const u of recipients) {
      void sendPushNotification(u.id, title, message, { url: issueUrl, issueId: issue.id })
    }
  }

  if (useEmail) {
    for (const u of recipients) {
      if (!u.email) continue
      void sendEmail({
        to: u.email,
        subject: title,
        html: `<p>${message}</p><p><a href="${appUrl}${issueUrl}">View Issue →</a></p>`,
      })
    }
  }
}
