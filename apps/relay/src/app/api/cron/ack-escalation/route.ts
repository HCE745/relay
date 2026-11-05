import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { sendEmail } from "@/lib/email"
import { sendPushNotification } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"

interface EscalationConfig {
  enabled: boolean
  delayMinutes: number
  recipients: {
    roles?: string[]
    userIds?: string[]
  }
}

function parseEscalationConfig(raw: unknown): EscalationConfig | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (typeof c.enabled !== "boolean" || typeof c.delayMinutes !== "number") return null
  return c as unknown as EscalationConfig
}

// Runs every minute. Finds CRITICAL/HIGH issues that remain unacknowledged past the
// configured delay, dispatches escalation notifications, then stamps escalationSentAt
// to prevent duplicates. Accuracy is ±1 minute relative to the configured delay.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Load all orgs with escalation enabled, checking config at query time is not
  // possible in SQL for JSON fields, so we load all with a non-null config and filter.
  const orgs = await prisma.organization.findMany({
    where: { ackEscalationConfig: { not: Prisma.DbNull } },
    select: { id: true, ackEscalationConfig: true },
  })

  let escalated = 0
  let skipped = 0

  for (const org of orgs) {
    const config = parseEscalationConfig(org.ackEscalationConfig)
    if (!config || !config.enabled || config.delayMinutes <= 0) {
      skipped++
      continue
    }

    const cutoff = new Date(now.getTime() - config.delayMinutes * 60 * 1000)

    // Find issues that need escalation: CRITICAL or HIGH, still open,
    // not yet acknowledged, not yet escalated, created before the cutoff.
    const issues = await prisma.issue.findMany({
      where: {
        organizationId: org.id,
        priority:        { in: ["CRITICAL", "HIGH"] },
        status:          { notIn: ["RESOLVED", "CLOSED"] },
        acknowledgedAt:  null,
        escalationSentAt: null,
        createdAt:       { lte: cutoff },
      },
      select: { id: true, title: true, priority: true },
    })

    if (!issues.length) continue

    // Resolve recipients
    const recipientRoles   = config.recipients.roles   ?? []
    const recipientUserIds = config.recipients.userIds ?? []

    const [roleUsers, specificUsers] = await Promise.all([
      recipientRoles.length > 0
        ? prisma.user.findMany({
            where: { organizationId: org.id, isActive: true, role: { in: recipientRoles } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      recipientUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: recipientUserIds }, organizationId: org.id, isActive: true },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ])

    const usersMap = new Map<string, { id: string; name: string; email: string }>()
    for (const u of [...roleUsers, ...specificUsers]) usersMap.set(u.id, u)
    const recipients = Array.from(usersMap.values())

    if (!recipients.length) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

    for (const issue of issues) {
      const issueUrl = `/issues/${issue.id}`
      const title    = `[ESCALATION] Unacknowledged ${issue.priority} issue: ${issue.title}`
      const message  = `A ${issue.priority.toLowerCase()} issue has not been acknowledged after ${config.delayMinutes} minutes: "${issue.title}"`

      await prisma.$transaction([
        // Stamp escalationSentAt atomically — prevents duplicate sends if cron overlaps
        prisma.issue.update({
          where: { id: issue.id },
          data:  { escalationSentAt: now },
        }),
        prisma.issueHistory.create({
          data: {
            issueId:     issue.id,
            field:       "escalationSentAt",
            oldValue:    null,
            newValue:    `Escalation sent to ${recipients.length} recipient(s) after ${config.delayMinutes} min`,
            changedById: null,
          },
        }),
        prisma.notification.createMany({
          data: recipients.map(u => ({
            userId:         u.id,
            organizationId: org.id,
            issueId:        issue.id,
            type:           "ISSUE_ALERT",
            title,
            message,
          })),
          skipDuplicates: true,
        }),
      ])

      // Push and email fire-and-forget after the transaction
      for (const u of recipients) {
        void sendPushNotification(u.id, title, message, { url: issueUrl, issueId: issue.id })
        if (u.email) {
          void sendEmail({
            to:      u.email,
            subject: title,
            html:    `<p>${message}</p><p><a href="${appUrl}${issueUrl}">View Issue →</a></p>`,
          })
        }
      }

      escalated++
    }
  }

  return NextResponse.json({ ok: true, escalated, skipped })
}
