// Pure functions extracted from the config engine — no server-only, no DB calls.
// These can be safely imported in both server and client/test contexts.
import { randomUUID } from "crypto"
import { isWashEssentials, WASH_ESSENTIALS_MAX_LOCATIONS } from "@/lib/pricing"
import type { ConfigOperation, CreateDepartmentOp, CreateRoutingRuleOp } from "./allowlist"
import { opLabel } from "./allowlist"

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

export interface OrgContext {
  locations: Array<{ id: string; name: string; locationType: string | null }>
  departments: Array<{ id: string; name: string; locationId: string | null }>
  routingRules: Array<{ id: string; name: string; condCategory: string | null; condLocationId: string | null; condDeptId: string | null; assignToRole: string | null }>
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
  const newDeptKeys = new Set<string>()

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

// ── Resolver (pure) ───────────────────────────────────────────────────────────

export function resolveLocationRef(
  ref: string | undefined,
  ctx: OrgContext,
  batchCreated: Map<string, string> = new Map(),
): string | undefined {
  if (!ref) return undefined
  const refLower = ref.toLowerCase()
  for (const [name, id] of batchCreated) {
    if (name.toLowerCase() === refLower) return id
  }
  const match = ctx.locations.find(l => l.name.toLowerCase() === refLower)
  return match?.id
}

export function resolveOperationRefs(
  ops: ConfigOperation[],
  ctx: OrgContext,
): { resolved: ConfigOperation[]; errors: string[] } {
  const errors: string[] = []
  const batchLocations = new Map<string, string>()

  for (const op of ops) {
    if (op.type === "CREATE_LOCATION") {
      batchLocations.set(op.name, "__pending__")
    }
  }

  const resolved = ops.map(op => {
    if (op.type === "CREATE_DEPARTMENT") {
      const dOp = op as CreateDepartmentOp
      if (dOp.locationRef && !dOp.locationId) {
        const isBatch = [...batchLocations.keys()].some(
          k => k.toLowerCase() === dOp.locationRef!.toLowerCase()
        )
        if (!isBatch) {
          const id = ctx.locations.find(l => l.name.toLowerCase() === dOp.locationRef!.toLowerCase())?.id
          if (!id) errors.push(`Unknown location "${dOp.locationRef}"`)
          return { ...op, locationId: id ?? undefined }
        }
        return op
      }
    }
    return op
  })

  return { resolved, errors }
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
          title = op.name ?? op.locationId
          detail = "Update location"
          break
        case "CREATE_DEPARTMENT": {
          const dOp = op as CreateDepartmentOp
          title = op.name
          detail = dOp.locationRef ? `at ${dOp.locationRef}` : "No specific location"
          break
        }
        case "UPDATE_DEPARTMENT":
          title = op.name ?? op.departmentId
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
