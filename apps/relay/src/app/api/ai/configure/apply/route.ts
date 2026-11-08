import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { executeBatch, writeAuditLog } from "@/lib/config-engine"
import type { ConfigOperation } from "@/lib/config-engine"
import { prisma } from "@/lib/prisma"
import type { InputJsonValue } from "@prisma/client/runtime/client"

const toJson = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

// POST /api/ai/configure/apply
// Executes an approved batch of operations.
// The client sends the full operations array (validated by /api/ai/configure).
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can apply AI configuration changes." }, { status: 403 })
  }

  const orgId = session.organizationId
  const userId = session.userId

  const body = await request.json() as {
    batchId: string
    operations: ConfigOperation[]
    sessionId?: string
  }

  if (!body.batchId || !Array.isArray(body.operations) || body.operations.length === 0) {
    return NextResponse.json({ error: "batchId and operations are required." }, { status: 400 })
  }

  // Check for duplicate batch execution (idempotency at batch level)
  const existingBatch = await prisma.configurationAuditLog.findFirst({
    where: { organizationId: orgId, batchId: body.batchId },
  })
  if (existingBatch) {
    return NextResponse.json({ error: "This batch has already been applied." }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Execute the batch
  const { results, applied, failed } = await executeBatch(
    body.operations,
    orgId,
    userId,
    appUrl,
  )

  // Write audit log for successful operations
  await writeAuditLog(
    orgId,
    userId,
    body.batchId,
    body.sessionId ?? null,
    body.operations,
    results,
  )

  // Update OnboardingSession stageData with created entity IDs
  if (body.sessionId || applied > 0) {
    const locationIds = results
      .filter(r => r.success && r.type === "CREATE_LOCATION" && r.targetId)
      .map(r => r.targetId!)

    const deptIds = results
      .filter(r => r.success && r.type === "CREATE_DEPARTMENT" && r.targetId)
      .map(r => r.targetId!)

    if (locationIds.length > 0 || deptIds.length > 0) {
      const existing = await prisma.onboardingSession.findUnique({
        where: { organizationId: orgId },
        select: { stageData: true },
      })

      const stageData = (existing?.stageData ?? {}) as Record<string, unknown>
      const stage2 = (stageData.stage2 ?? {}) as Record<string, unknown>

      if (locationIds.length > 0) {
        stage2.locationsCreated = [
          ...((stage2.locationsCreated as string[]) ?? []),
          ...locationIds,
        ]
      }
      if (deptIds.length > 0) {
        stage2.departmentsCreated = [
          ...((stage2.departmentsCreated as string[]) ?? []),
          ...deptIds,
        ]
      }

      stageData.stage2 = stage2

      await prisma.onboardingSession.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, stageData: toJson(stageData) },
        update: { stageData: toJson(stageData) },
      })
    }
  }

  // Build a user-facing confirmation message
  const successTypes = results.filter(r => r.success).map(r => r.type)
  const locationCount = successTypes.filter(t => t === "CREATE_LOCATION").length
  const deptCount = successTypes.filter(t => t === "CREATE_DEPARTMENT").length
  const ruleCount = successTypes.filter(t => t === "CREATE_ROUTING_RULE").length

  const parts: string[] = []
  if (locationCount > 0) parts.push(`${locationCount} location${locationCount > 1 ? "s" : ""}`)
  if (deptCount > 0) parts.push(`${deptCount} department${deptCount > 1 ? "s" : ""}`)
  if (ruleCount > 0) parts.push(`${ruleCount} routing rule${ruleCount > 1 ? "s" : ""}`)

  const confirmation = parts.length > 0
    ? `${parts.join(", ")} created successfully.`
    : applied > 0
    ? `${applied} change${applied > 1 ? "s" : ""} applied successfully.`
    : "No changes were applied."

  const failures = results
    .filter(r => !r.success)
    .map(r => ({ type: r.type, error: r.error }))

  return NextResponse.json({
    applied,
    failed,
    confirmation,
    failures: failures.length > 0 ? failures : undefined,
    results,
  })
}
