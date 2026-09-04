import { prisma } from "@/lib/prisma"
import { sendEmail, injuryAlertEmail } from "@/lib/email"
import { sendPushNotification } from "@/lib/push-notifications"

export type InjurySeverity = "MINOR" | "MODERATE" | "SEVERE"
export type NotificationChannel = "in_app" | "email" // future: "sms"

export interface InjuryNotificationContext {
  organizationId: string
  issueId: string
  reporterName: string
  severity: InjurySeverity
  injuryDescription: string
  locationId: string | null
  locationName: string | null
  supervisorId: string | null
  excludeUserId: string
}

const SEVERITY_LABEL: Record<InjurySeverity, string> = {
  MINOR: "Minor",
  MODERATE: "Moderate",
  SEVERE: "Severe/Emergency",
}

async function buildRecipientIds(ctx: InjuryNotificationContext): Promise<Set<string>> {
  const ids = new Set<string>()

  // Supervisor always included for all severity levels
  if (ctx.supervisorId) ids.add(ctx.supervisorId)

  // Safety contact added for MODERATE and SEVERE
  if ((ctx.severity === "MODERATE" || ctx.severity === "SEVERE") && ctx.locationId) {
    const loc = await prisma.location.findUnique({
      where: { id: ctx.locationId },
      select: { safetyContactId: true },
    })
    if (loc?.safetyContactId) ids.add(loc.safetyContactId)
  }

  // All management and HR added for SEVERE
  if (ctx.severity === "SEVERE") {
    const [managers, hrUsers] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: ctx.organizationId, isActive: true, role: { in: ["MANAGER", "ADMIN"] } },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: { organizationId: ctx.organizationId, isActive: true, role: "HR" },
        select: { id: true },
      }),
    ])
    managers.forEach(u => ids.add(u.id))
    hrUsers.forEach(u => ids.add(u.id))
  }

  ids.delete(ctx.excludeUserId)
  return ids
}

export async function dispatchInjuryNotifications(
  ctx: InjuryNotificationContext,
  channels: NotificationChannel[] = ["in_app", "email"],
): Promise<void> {
  const recipientIds = await buildRecipientIds(ctx)
  if (recipientIds.size === 0) return

  const severityLabel = SEVERITY_LABEL[ctx.severity]
  const isUrgent = ctx.severity === "SEVERE"
  const notifTitle = `${isUrgent ? "URGENT: " : ""}Injury Report — ${severityLabel}`
  const notifMessage = `${ctx.reporterName} submitted an injury report${ctx.locationName ? ` at ${ctx.locationName}` : ""}. Immediate attention required.`

  if (channels.includes("in_app")) {
    await prisma.notification.createMany({
      data: Array.from(recipientIds).map(uid => ({
        userId:         uid,
        organizationId: ctx.organizationId,
        issueId:        ctx.issueId,
        type:           "INJURY_REPORT",
        title:          notifTitle,
        message:        notifMessage,
      })),
    })
    // Fire push for each recipient (non-blocking)
    for (const uid of recipientIds) {
      void sendPushNotification(uid, notifTitle, notifMessage, {
        url:     `/issues/${ctx.issueId}`,
        issueId: ctx.issueId,
      })
    }
  }

  if (channels.includes("email")) {
    const [org, recipientUsers] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true, injuryAlertEmails: true },
      }),
      prisma.user.findMany({
        where: { id: { in: Array.from(recipientIds) }, isActive: true },
        select: { email: true },
      }),
    ])

    const configuredEmails = Array.isArray(org?.injuryAlertEmails)
      ? (org!.injuryAlertEmails as string[])
      : []

    const allEmails = [
      ...new Set([
        ...recipientUsers.map(u => u.email).filter(Boolean),
        ...configuredEmails,
      ]),
    ] as string[]

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    const subject = isUrgent
      ? `[URGENT] Severe Injury Report — ${ctx.reporterName} — ${org?.name ?? ""}`
      : `[Injury Report — ${severityLabel}] ${ctx.reporterName}`

    for (const email of allEmails) {
      sendEmail({
        to: email,
        subject,
        html: injuryAlertEmail({
          reporterName:      ctx.reporterName,
          severity:          ctx.severity,
          injuryDescription: ctx.injuryDescription,
          locationName:      ctx.locationName,
          issueUrl:          `${appUrl}/issues/${ctx.issueId}`,
          orgName:           org?.name ?? "Your Organization",
        }),
      }).catch(console.error)
    }
  }

  // Future channel: sms
  // if (channels.includes("sms")) { await dispatchSmsBatch(recipientIds, ctx) }
}
