import "server-only"
import { prisma } from "@/lib/prisma"
import type {
  ConfigOperation,
  CreateDepartmentOp,
  UpdateDepartmentOp,
  CreateRoutingRuleOp,
  UpdateLocationOp,
} from "./allowlist"

export interface OrgContext {
  locations: Array<{ id: string; name: string; locationType: string | null }>
  departments: Array<{ id: string; name: string; locationId: string | null }>
  routingRules: Array<{ id: string; name: string; condCategory: string | null; condLocationId: string | null; condDeptId: string | null; assignToRole: string | null }>
}

// Load the current state of the org for context building and resolution
export async function loadOrgContext(orgId: string): Promise<OrgContext> {
  const [locations, departments, routingRules] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, locationType: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, locationId: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.routingRule.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, condCategory: true, condLocationId: true, condDeptId: true, assignToRole: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])
  return { locations, departments, routingRules }
}

// Resolve locationRef (name) to locationId within a batch.
// batchCreated tracks locations created earlier in this same batch so they can be referenced.
export function resolveLocationRef(
  ref: string | undefined,
  ctx: OrgContext,
  batchCreated: Map<string, string> = new Map(),
): string | undefined {
  if (!ref) return undefined

  // Check batch-created locations first (case-insensitive)
  const refLower = ref.toLowerCase()
  for (const [name, id] of batchCreated) {
    if (name.toLowerCase() === refLower) return id
  }

  // Then existing locations
  const match = ctx.locations.find(l => l.name.toLowerCase() === refLower)
  return match?.id
}

export function resolveDeptRef(
  ref: string | undefined,
  ctx: OrgContext,
  batchCreatedDepts: Map<string, string> = new Map(),
): string | undefined {
  if (!ref) return undefined
  const refLower = ref.toLowerCase()
  for (const [name, id] of batchCreatedDepts) {
    if (name.toLowerCase() === refLower) return id
  }
  const match = ctx.departments.find(d => d.name.toLowerCase() === refLower)
  return match?.id
}

// Fill in resolved IDs from refs, and validate refs are resolvable.
// Returns a list of unresolvable ref errors, or empty array if all good.
export function resolveOperationRefs(
  ops: ConfigOperation[],
  ctx: OrgContext,
): { resolved: ConfigOperation[]; errors: string[] } {
  const errors: string[] = []
  const batchLocations = new Map<string, string>()   // name → temp placeholder (pre-execution)
  const batchDepts = new Map<string, string>()

  // First pass: register CREATE_LOCATION names as resolvable within batch
  for (const op of ops) {
    if (op.type === "CREATE_LOCATION") {
      batchLocations.set(op.name, "__pending__")
    }
  }

  const resolved = ops.map(op => {
    if (op.type === "CREATE_DEPARTMENT") {
      const dOp = op as CreateDepartmentOp
      if (dOp.locationRef && !dOp.locationId) {
        const id = resolveLocationRef(dOp.locationRef, ctx, batchLocations)
        if (!id && id !== "__pending__") {
          // Check if it's a batch-created location (will be resolved at execution time)
          const isBatch = [...batchLocations.keys()].some(
            k => k.toLowerCase() === dOp.locationRef!.toLowerCase()
          )
          if (!isBatch) {
            errors.push(`Unknown location "${dOp.locationRef}"`)
          }
        }
        return { ...op, locationId: id ?? undefined }
      }
    }

    if (op.type === "UPDATE_DEPARTMENT") {
      const dOp = op as UpdateDepartmentOp
      if (dOp.locationRef && !dOp.locationId) {
        const id = resolveLocationRef(dOp.locationRef, ctx, batchLocations)
        return { ...op, locationId: id }
      }
    }

    if (op.type === "UPDATE_LOCATION") {
      return op as UpdateLocationOp
    }

    if (op.type === "CREATE_ROUTING_RULE") {
      const rOp = op as CreateRoutingRuleOp
      const updates: Partial<CreateRoutingRuleOp> = {}
      if (rOp.condLocationRef && !rOp.condLocationId) {
        const id = resolveLocationRef(rOp.condLocationRef, ctx, batchLocations)
        if (!id) errors.push(`Unknown location "${rOp.condLocationRef}"`)
        updates.condLocationId = id
      }
      if (rOp.condDeptRef && !rOp.condDeptId) {
        const id = resolveDeptRef(rOp.condDeptRef, ctx, batchDepts)
        if (!id) errors.push(`Unknown department "${rOp.condDeptRef}"`)
        updates.condDeptId = id
      }
      return { ...op, ...updates }
    }

    return op
  })

  return { resolved, errors }
}
