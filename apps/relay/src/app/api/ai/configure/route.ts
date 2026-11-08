import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  buildOrgSnapshot,
  extractOperations,
  validateOperations,
  generatePreview,
} from "@/lib/config-engine"
import { resolveOperationRefs, loadOrgContext } from "@/lib/config-engine/resolver"

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

// POST /api/ai/configure
// Accepts a natural-language message + conversation history.
// Returns either a clarification question or a validated batch preview.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can use the AI configuration assistant." }, { status: 403 })
  }

  // Check API key availability
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI assistance is not configured for this environment." }, { status: 503 })
  }

  const orgId = session.organizationId
  const body = await request.json() as {
    message: string
    history?: ConversationMessage[]
    sessionId?: string
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 })
  }

  // Rate limit: check recent AI operations
  const windowMs = 60 * 60 * 1000
  const maxRequests = 30
  const since = new Date(Date.now() - windowMs)
  const { prisma } = await import("@/lib/prisma")
  const recentCount = await prisma.configurationAuditLog.count({
    where: { organizationId: orgId, source: "AI", appliedAt: { gte: since } },
  })
  if (recentCount >= maxRequests) {
    return NextResponse.json(
      { error: "AI configuration rate limit reached. Please wait before making more requests." },
      { status: 429 }
    )
  }

  // Build conversation history
  const history: ConversationMessage[] = [
    ...(body.history ?? []),
    { role: "user", content: body.message },
  ]

  // Build org snapshot for context
  const snapshot = await buildOrgSnapshot(orgId)

  // Extract operations from Claude
  const result = await extractOperations(snapshot, history)

  if (result.type === "clarification") {
    return NextResponse.json({
      type: "clarification",
      question: result.question,
      history: [...history, { role: "assistant", content: result.question }],
    })
  }

  // Resolve name refs to IDs
  const ctx = await loadOrgContext(orgId)
  const { resolved, errors: resolverErrors } = resolveOperationRefs(result.operations, ctx)

  if (resolverErrors.length > 0) {
    return NextResponse.json({
      type: "error",
      errors: resolverErrors,
    }, { status: 422 })
  }

  // Validate operations
  const validation = await validateOperations(resolved, snapshot)

  if (!validation.valid) {
    return NextResponse.json({
      type: "validation_error",
      errors: validation.errors,
      warnings: validation.warnings,
    }, { status: 422 })
  }

  // Generate preview
  const preview = generatePreview(resolved, result.summary, validation.warnings)

  // Store the pending ops in the preview so apply can retrieve them
  const assistantSummary = `I'll ${result.summary}. Please review the preview above and click Approve to apply these changes.`

  return NextResponse.json({
    type: "preview",
    preview,
    operations: resolved,
    history: [...history, { role: "assistant", content: assistantSummary }],
  })
}
