import "server-only"
import { randomUUID } from "crypto"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { isWashEssentials, WASH_ESSENTIALS_MAX_LOCATIONS } from "@/lib/pricing"
import { loadOrgContext, resolveOperationRefs } from "./resolver"
import type { ConfigOperation, CreateDepartmentOp, UpdateDepartmentOp, CreateLocationOp, CreateRoutingRuleOp } from "./allowlist"
import { isAllowedOp, opLabel } from "./allowlist"
import type { InputJsonValue } from "@prisma/client/runtime/client"

const toJson = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

export type { ConfigOperation }

// ── Context Builder ────────────────────────────────────────────────────────────

export interface OrgSnapshot {
  plan: string
  productLine: string
  locationCount: number
  locationLimit: number | null
  departmentsBlocked: boolean
  locations: Array<{ id: string; name: string; locationType: string | null }>
  departments: Array<{ id: string; name: string; locationId: string | null; locationName?: string }>
  routingRules: Array<{ id: string; name: string; condCategory: string | null; assignToRole: string | null }>
}

export async function buildOrgSnapshot(orgId: string): Promise<OrgSnapshot> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { plan: true, productLine: true, locationLimit: true },
  })

  const ctx = await loadOrgContext(orgId)

  const locationNamesById = new Map(ctx.locations.map(l => [l.id, l.name]))

  return {
    plan: org.plan,
    productLine: org.productLine,
    locationCount: ctx.locations.length,
    locationLimit: org.locationLimit,
    departmentsBlocked: isWashEssentials(org.productLine),
    locations: ctx.locations,
    departments: ctx.departments.map(d => ({
      ...d,
      locationName: d.locationId ? (locationNamesById.get(d.locationId) ?? undefined) : undefined,
    })),
    routingRules: ctx.routingRules.map(r => ({ id: r.id, name: r.name, condCategory: r.condCategory, assignToRole: r.assignToRole })),
  }
}

// ── Operation Extractor (Claude Sonnet) ───────────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

interface ExtractorResult {
  type: "clarification"
  question: string
}

interface BatchResult {
  type: "operations"
  operations: ConfigOperation[]
  summary: string
}

type AiEngineResult = ExtractorResult | BatchResult

function buildSystemPrompt(snapshot: OrgSnapshot): string {
  const locationList = snapshot.locations.length > 0
    ? snapshot.locations.map(l => `  - ${l.name}${l.locationType ? ` (${l.locationType})` : ""}`).join("\n")
    : "  (none yet)"

  const deptList = snapshot.departments.length > 0
    ? snapshot.departments.slice(0, 30).map(d => `  - ${d.name}${d.locationName ? ` @ ${d.locationName}` : ""}`).join("\n")
    : "  (none yet)"

  const ruleList = snapshot.routingRules.length > 0
    ? snapshot.routingRules.slice(0, 20).map(r => `  - ${r.name}${r.condCategory ? ` [${r.condCategory}]` : ""}${r.assignToRole ? ` → ${r.assignToRole}` : ""}`).join("\n")
    : "  (none yet)"

  return `You are an AI assistant that helps customers configure Relay, a facility operations platform.
You extract structured configuration operations from natural language requests.

CURRENT ORG STATE:
- Plan: ${snapshot.plan} (${snapshot.productLine})
- Location limit: ${snapshot.locationLimit ?? "none"} | Current locations: ${snapshot.locationCount}
- Departments blocked (Wash Essentials): ${snapshot.departmentsBlocked}

EXISTING LOCATIONS:
${locationList}

EXISTING DEPARTMENTS:
${deptList}

EXISTING ROUTING RULES:
${ruleList}

OPERATION ALLOWLIST (use ONLY these types):
- CREATE_LOCATION: { type, idempotencyKey, name, locationType?, address?, city?, state?, country? }
- CREATE_DEPARTMENT: { type, idempotencyKey, name, locationRef? }  — locationRef is the EXACT location name
- CREATE_ROUTING_RULE: { type, idempotencyKey, name, condCategory?, condLocationRef?, condDeptRef?, condPriority?, assignToRole? }
- UPDATE_ORG_PROFILE: { type, idempotencyKey, name?, industry?, companySize? }
- UPDATE_LOCATION: { type, idempotencyKey, locationId, name?, locationType?, address?, city?, state? }
- UPDATE_DEPARTMENT: { type, idempotencyKey, departmentId, name?, locationRef? }

RULES:
1. NEVER create entities that already exist (check the lists above carefully).
2. If creating departments for multiple locations, create each as a separate operation with the correct locationRef.
3. Issue categories are platform-defined (MAINTENANCE, SAFETY, GENERAL, EQUIPMENT_BREAKDOWN, CUSTOMER_COMPLAINT, SUPPLY_SHORTAGE, FACILITY, EMPLOYEE) — not configurable. Use CREATE_ROUTING_RULE to map categories to departments.
4. If you need information to complete the request (e.g., names of locations), ask ONE clarification question.
5. Each operation must have a unique idempotencyKey (a short slug, e.g. "create-loc-main-plant").
6. If departments are blocked (Wash Essentials), do not propose CREATE_DEPARTMENT.
7. Never propose subscription, billing, or super-admin changes.

RESPONSE FORMAT:
If you need clarification, respond with ONLY valid JSON:
{ "type": "clarification", "question": "..." }

If you have enough information, respond with ONLY valid JSON:
{ "type": "operations", "summary": "...", "operations": [...] }

Do not include markdown, prose, or anything outside the JSON.`
}

export async function extractOperations(
  snapshot: OrgSnapshot,
  history: ConversationMessage[],
): Promise<AiEngineResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { type: "clarification", question: "AI assistance is not configured for this environment." }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-5",
        max_tokens: 2048,
        system:     buildSystemPrompt(snapshot),
        messages:   history,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "")
      console.error("AI configure API error:", res.status, err)
      return { type: "clarification", question: "AI is temporarily unavailable. Please try again or configure manually." }
    }

    const data = await res.json() as { content?: Array<{ text: string }> }
    const text = data?.content?.[0]?.text?.trim()
    if (!text) return { type: "clarification", question: "AI returned an empty response. Please try rephrasing your request." }

    const parsed = JSON.parse(text)
    if (parsed.type === "clarification") return parsed as ExtractorResult
    if (parsed.type === "operations") {
      // Validate each operation type is in the allowlist
      const ops = (parsed.operations as Array<Record<string, unknown>>).filter(op =>
        typeof op.type === "string" && isAllowedOp(op.type)
      ) as unknown as ConfigOperation[]
      return { type: "operations", operations: ops, summary: parsed.summary ?? "" }
    }
    return { type: "clarification", question: "Could not understand the AI response. Please try rephrasing." }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { type: "clarification", question: "Request timed out. Please try again." }
    }
    console.error("extractOperations error:", err)
    return { type: "clarification", question: "An unexpected error occurred. Please try again or configure manually." }
  } finally {
    clearTimeout(timer)
  }
}

// ── Validator ─────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export async function validateOperations(
  ops: ConfigOperation[],
  snapshot: OrgSnapshot,
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const newLocNames = new Set<string>()
  const newDeptKeys = new Set<string>()  // "name@locationRef"

  const locationLimitCap = snapshot.locationLimit ?? (
    isWashEssentials(snapshot.productLine) ? WASH_ESSENTIALS_MAX_LOCATIONS : Infinity
  )

  let projectedLocCount = snapshot.locationCount

  for (const op of ops) {
    if (op.type === "CREATE_LOCATION") {
      if (isWashEssentials(snapshot.productLine) && projectedLocCount + 1 > WASH_ESSENTIALS_MAX_LOCATIONS) {
        errors.push(`Cannot create location "${op.name}": Wash Essentials is limited to ${WASH_ESSENTIALS_MAX_LOCATIONS} locations.`)
        continue
      }
      if (snapshot.locationLimit && projectedLocCount + 1 > snapshot.locationLimit) {
        errors.push(`Cannot create location "${op.name}": your plan allows at most ${snapshot.locationLimit} locations.`)
        continue
      }
      const existing = snapshot.locations.find(l => l.name.toLowerCase() === op.name.toLowerCase())
      if (existing) {
        warnings.push(`Location "${op.name}" already exists — will be skipped.`)
        continue
      }
      if (newLocNames.has(op.name.toLowerCase())) {
        warnings.push(`Duplicate location "${op.name}" in this batch — only one will be created.`)
        continue
      }
      newLocNames.add(op.name.toLowerCase())
      projectedLocCount++
    }

    if (op.type === "CREATE_DEPARTMENT") {
      if (snapshot.departmentsBlocked) {
        errors.push(`Cannot create department "${op.name}": departments are not available on Wash Essentials. Upgrade to Full Relay to use departments.`)
        continue
      }
      const dOp = op as CreateDepartmentOp
      const locRef = dOp.locationRef?.toLowerCase()
      const key = `${op.name.toLowerCase()}@${locRef ?? ""}`
      const existsInOrg = snapshot.departments.some(
        d => d.name.toLowerCase() === op.name.toLowerCase() &&
          (locRef ? (d.locationName?.toLowerCase() === locRef) : !d.locationId)
      )
      if (existsInOrg) {
        warnings.push(`Department "${op.name}"${dOp.locationRef ? ` at ${dOp.locationRef}` : ""} already exists — will be skipped.`)
        continue
      }
      if (newDeptKeys.has(key)) {
        warnings.push(`Duplicate department "${op.name}"${dOp.locationRef ? ` at ${dOp.locationRef}` : ""} in batch — only one will be created.`)
        continue
      }
      newDeptKeys.add(key)
    }

    if (op.type === "CREATE_ROUTING_RULE") {
      const rOp = op as CreateRoutingRuleOp
      if (!rOp.assignToRole && !rOp.assignToUserId) {
        errors.push(`Routing rule "${rOp.name}" needs an assignToRole or assignToUserId.`)
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── Preview Generator ─────────────────────────────────────────────────────────

export interface OperationPreviewItem {
  idempotencyKey: string
  type: ConfigOperation["type"]
  label: string
  title: string
  detail: string
}

export interface BatchPreview {
  batchId: string
  summary: string
  items: OperationPreviewItem[]
  warnings: string[]
}

export function generatePreview(
  ops: ConfigOperation[],
  summary: string,
  warnings: string[],
): BatchPreview {
  const batchId = `batch_${randomUUID().replace(/-/g, "").slice(0, 12)}`

  const items: OperationPreviewItem[] = ops
    .filter(op => op.type !== "EXPLAIN")
    .map(op => {
      let title = ""
      let detail = ""

      switch (op.type) {
        case "CREATE_LOCATION":
          title = op.name
          detail = [op.locationType, op.city, op.state].filter(Boolean).join(", ") || "New location"
          break
        case "UPDATE_LOCATION":
          title = (op as { locationId: string; name?: string }).name ?? op.locationId
          detail = "Update location"
          break
        case "CREATE_DEPARTMENT": {
          const dOp = op as CreateDepartmentOp
          title = op.name
          detail = dOp.locationRef ? `at ${dOp.locationRef}` : "No specific location"
          break
        }
        case "UPDATE_DEPARTMENT":
          title = (op as UpdateDepartmentOp).name ?? (op as UpdateDepartmentOp).departmentId
          detail = "Update department"
          break
        case "CREATE_ROUTING_RULE": {
          const rOp = op as CreateRoutingRuleOp
          const parts: string[] = []
          if (rOp.condCategory) parts.push(`Category: ${rOp.condCategory}`)
          if (rOp.condLocationRef) parts.push(`Location: ${rOp.condLocationRef}`)
          if (rOp.condDeptRef) parts.push(`Dept: ${rOp.condDeptRef}`)
          if (rOp.assignToRole) parts.push(`→ ${rOp.assignToRole}`)
          title = rOp.name
          detail = parts.join(" · ") || "Routing rule"
          break
        }
        case "UPDATE_ORG_PROFILE":
          title = "Organization profile"
          detail = "Update settings"
          break
        // EXPLAIN ops are filtered out before this map; this is unreachable at runtime
        default:
          title = (op as unknown as { field?: string; type: string }).field ?? (op as unknown as { type: string }).type
          detail = ""
      }

      return {
        idempotencyKey: op.idempotencyKey,
        type: op.type,
        label: opLabel(op.type),
        title,
        detail,
      }
    })

  return { batchId, summary, items, warnings }
}

// ── Executor ──────────────────────────────────────────────────────────────────

interface ExecutionResult {
  idempotencyKey: string
  type: string
  success: boolean
  targetId?: string
  error?: string
}

export async function executeBatch(
  ops: ConfigOperation[],
  orgId: string,
  userId: string,
  baseUrl: string,
): Promise<{ results: ExecutionResult[]; applied: number; failed: number }> {
  const results: ExecutionResult[] = []
  const locationIdMap = new Map<string, string>() // name → actual DB id after creation

  // Pre-populate existing locations
  const ctx = await loadOrgContext(orgId)
  for (const loc of ctx.locations) {
    locationIdMap.set(loc.name.toLowerCase(), loc.id)
  }

  // Execute in dependency order: locations first, then departments, then routing rules, then others
  const ordered = [
    ...ops.filter(op => op.type === "CREATE_LOCATION"),
    ...ops.filter(op => op.type === "UPDATE_LOCATION"),
    ...ops.filter(op => op.type === "CREATE_DEPARTMENT"),
    ...ops.filter(op => op.type === "UPDATE_DEPARTMENT"),
    ...ops.filter(op => op.type === "CREATE_ROUTING_RULE"),
    ...ops.filter(op => !["CREATE_LOCATION","UPDATE_LOCATION","CREATE_DEPARTMENT","UPDATE_DEPARTMENT","CREATE_ROUTING_RULE"].includes(op.type)),
  ]

  for (const op of ordered) {
    if (op.type === "EXPLAIN") continue

    // Check idempotency: skip if already applied
    const existing = await prisma.configurationAuditLog.findFirst({
      where: { organizationId: orgId, idempotencyKey: op.idempotencyKey },
    })
    if (existing) {
      results.push({ idempotencyKey: op.idempotencyKey, type: op.type, success: true, targetId: existing.targetId ?? undefined })
      continue
    }

    try {
      let targetId: string | undefined
      let apiBody: Record<string, unknown> = {}
      let apiPath = ""
      let method = "POST"

      switch (op.type) {
        case "CREATE_LOCATION":
          apiPath = "/api/locations"
          apiBody = {
            name: (op as CreateLocationOp).name,
            locationType: (op as CreateLocationOp).locationType,
            address: (op as CreateLocationOp).address,
            city: (op as CreateLocationOp).city,
            state: (op as CreateLocationOp).state,
            country: (op as CreateLocationOp).country,
          }
          break
        case "CREATE_DEPARTMENT": {
          const dOp = op as CreateDepartmentOp
          let locationId = dOp.locationId
          if (!locationId && dOp.locationRef) {
            locationId = locationIdMap.get(dOp.locationRef.toLowerCase())
          }
          apiPath = "/api/departments"
          apiBody = { name: dOp.name, locationId: locationId || undefined }
          break
        }
        case "CREATE_ROUTING_RULE": {
          const rOp = op as CreateRoutingRuleOp
          let condLocationId = rOp.condLocationId
          if (!condLocationId && rOp.condLocationRef) {
            condLocationId = locationIdMap.get(rOp.condLocationRef.toLowerCase())
          }
          apiPath = "/api/routing-rules"
          apiBody = {
            name: rOp.name,
            condCategory: rOp.condCategory,
            condLocationId,
            condPriority: rOp.condPriority,
            assignToRole: rOp.assignToRole,
            assignToUserId: rOp.assignToUserId,
          }
          break
        }
        case "UPDATE_ORG_PROFILE":
          apiPath = "/api/settings/workspace"
          method = "PATCH"
          apiBody = { name: op.name, industry: op.industry }
          break
        default:
          results.push({ idempotencyKey: op.idempotencyKey, type: op.type, success: false, error: `Unsupported operation ${op.type}` })
          continue
      }

      const res = await fetch(`${baseUrl}${apiPath}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          // Forward the orgId for server-side auth — the route handler uses getSession()
          // which reads from the JWT cookie. For server-to-server calls we pass it inline.
          "x-ai-executor-orgid": orgId,
          "x-ai-executor-userid": userId,
        },
        body: JSON.stringify(apiBody),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as { error?: string }
        results.push({ idempotencyKey: op.idempotencyKey, type: op.type, success: false, error: errJson.error ?? `HTTP ${res.status}` })
        continue
      }

      const created = await res.json() as { id?: string }
      targetId = created.id

      if (op.type === "CREATE_LOCATION" && targetId) {
        locationIdMap.set((op as CreateLocationOp).name.toLowerCase(), targetId)
      }

      results.push({ idempotencyKey: op.idempotencyKey, type: op.type, success: true, targetId })
    } catch (err) {
      results.push({ idempotencyKey: op.idempotencyKey, type: op.type, success: false, error: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const applied = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  return { results, applied, failed }
}

// ── Audit Logger ──────────────────────────────────────────────────────────────

export async function writeAuditLog(
  orgId: string,
  actorId: string,
  batchId: string,
  sessionId: string | null,
  ops: ConfigOperation[],
  results: Array<{ idempotencyKey: string; type: string; success: boolean; targetId?: string; error?: string }>,
) {
  const records = results
    .filter(r => r.success)
    .map(r => {
      const op = ops.find(o => o.idempotencyKey === r.idempotencyKey)
      const afterValue = op ? sanitizeForAudit(op) : null
      return {
        id: randomUUID(),
        organizationId: orgId,
        actorId,
        source: "AI",
        operationType: r.type,
        idempotencyKey: r.idempotencyKey,
        targetModel: opTypeToModel(r.type),
        targetId: r.targetId ?? null,
        after: afterValue !== null ? (toJson(afterValue) as Prisma.InputJsonValue) : Prisma.JsonNull,
        batchId,
        sessionId,
        appliedAt: new Date(),
      }
    })

  if (records.length > 0) {
    await prisma.configurationAuditLog.createMany({ data: records })
  }
}

function opTypeToModel(type: string): string {
  if (type.includes("LOCATION")) return "Location"
  if (type.includes("DEPARTMENT")) return "Department"
  if (type.includes("ROUTING_RULE")) return "RoutingRule"
  if (type.includes("ORG")) return "Organization"
  return type
}

function sanitizeForAudit(op: ConfigOperation): Record<string, unknown> {
  // Strip internal ref fields, keep only the meaningful payload
  const { idempotencyKey: _, ...rest } = op
  return rest as Record<string, unknown>
}

// ── Rate Limiter ──────────────────────────────────────────────────────────────

export async function checkRateLimit(orgId: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 30

  const since = new Date(Date.now() - windowMs)
  const count = await prisma.configurationAuditLog.count({
    where: {
      organizationId: orgId,
      source: "AI",
      appliedAt: { gte: since },
    },
  })

  if (count >= maxRequests) {
    return { allowed: false, retryAfterMs: windowMs }
  }
  return { allowed: true }
}
