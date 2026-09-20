import { prisma } from "@/lib/prisma"

export type ActivationEventType =
  | "org_created"
  | "onboarding_completed"
  | "first_issue_created"
  | "first_team_member_invited"
  | "first_qr_code_created"
  | "trial_converted_to_paid"

export async function logActivationEvent(
  organizationId: string,
  eventType: ActivationEventType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Only log the first occurrence of each event type per org (idempotent)
    const existing = await prisma.orgAnalyticsEvent.findFirst({
      where: { organizationId, eventType },
      select: { id: true },
    })
    if (existing) return

    await prisma.orgAnalyticsEvent.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { organizationId, eventType, metadata: metadata as any },
    })
  } catch {
    // Analytics logging is non-critical — never throw
  }
}
