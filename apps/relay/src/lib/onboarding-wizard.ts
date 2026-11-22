import "server-only"
import { prisma } from "./prisma"
import type { SessionPayload } from "./session"
import type { Prisma } from "@/generated/prisma/client"

// ── Access guard ─────────────────────────────────────────────────────────────

export class WizardAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "WizardAccessError"
  }
}

/**
 * Validates that the caller is a super-admin and that the CustomerOnboarding
 * record exists and has not yet been launched.
 *
 * Returns `{ orgId, onboardingId }` on success; throws WizardAccessError on
 * any failure so callers can convert it to a NextResponse with a single catch.
 */
export async function requireWizardAccess(
  onboardingId: string,
  session: SessionPayload | null,
): Promise<{ orgId: string; onboardingId: string }> {
  if (!session?.superAdmin || !session.superAdminId) {
    throw new WizardAccessError("Forbidden", 403)
  }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id: onboardingId },
    select: { id: true, organizationId: true, status: true },
  })

  if (!record) {
    throw new WizardAccessError("Onboarding record not found", 404)
  }

  // Block writes after the invitation has been sent — the existing /launch flow
  // owns that transition. Only readiness (GET) is still allowed post-launch; the
  // callers of requireWizardAccess are all write-path routes.
  if (record.status === "invitation_sent" || record.status === "live") {
    throw new WizardAccessError(
      `Cannot modify configuration after invitation has been sent (status: ${record.status})`,
      409,
    )
  }

  return { orgId: record.organizationId, onboardingId: record.id }
}

// ── Audit log ────────────────────────────────────────────────────────────────

type AuditParams = {
  orgId:         string
  actorId:       string
  operationType: string
  targetModel?:  string
  targetId?:     string
  before?:       Record<string, unknown>
  after?:        Record<string, unknown>
  /** sessionId links every wizard action back to the CustomerOnboarding record. */
  sessionId:     string
}

const toJson = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue

export async function logWizardAction(params: AuditParams): Promise<void> {
  await prisma.configurationAuditLog.create({
    data: {
      organizationId: params.orgId,
      actorId:        params.actorId,
      source:         "wizard",
      operationType:  params.operationType,
      targetModel:    params.targetModel ?? null,
      targetId:       params.targetId   ?? null,
      before:         params.before ? toJson(params.before) : undefined,
      after:          params.after  ? toJson(params.after)  : undefined,
      sessionId:      params.sessionId,
      appliedAt:      new Date(),
    },
  })
}
