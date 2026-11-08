import { describe, it, expect } from "vitest"
import { isAllowedOp } from "@/lib/config-engine/allowlist"
import type { ConfigOperation } from "@/lib/config-engine/allowlist"
import {
  validateOperations,
  resolveOperationRefs,
  generatePreview,
} from "@/lib/config-engine/pure"
import type { OrgSnapshot, OrgContext } from "@/lib/config-engine/pure"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<OrgSnapshot> = {}): OrgSnapshot {
  return {
    plan: "professional",
    productLine: "RELAY_STANDARD",
    locationCount: 0,
    locationLimit: 15,
    departmentsBlocked: false,
    locations: [],
    departments: [],
    routingRules: [],
    ...overrides,
  }
}

function makeCtx(overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    locations: [],
    departments: [],
    routingRules: [],
    ...overrides,
  }
}

function makeOp(type: ConfigOperation["type"], extra: Record<string, unknown> = {}): ConfigOperation {
  return { type, idempotencyKey: `key-${type}`, ...extra } as ConfigOperation
}

// ── Validator tests ───────────────────────────────────────────────────────────

describe("validateOperations", () => {
  it("accepts valid CREATE_LOCATION on professional plan", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Main Plant" }),
    ]
    const result = await validateOperations(ops, makeSnapshot())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("rejects CREATE_DEPARTMENT on Wash Essentials", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance" }),
    ]
    const result = await validateOperations(ops, makeSnapshot({
      productLine: "WASH_ESSENTIALS",
      departmentsBlocked: true,
    }))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Wash Essentials")
  })

  it("warns (not errors) when location already exists", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Main Plant" }),
    ]
    const result = await validateOperations(ops, makeSnapshot({
      locations: [{ id: "loc1", name: "Main Plant", locationType: null }],
      locationCount: 1,
    }))
    expect(result.valid).toBe(true)
    expect(result.warnings[0]).toContain("already exists")
  })

  it("rejects CREATE_LOCATION when at plan location limit", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "New Location" }),
    ]
    const result = await validateOperations(ops, makeSnapshot({
      locationCount: 15,
      locationLimit: 15,
    }))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("plan allows at most 15")
  })

  it("rejects CREATE_ROUTING_RULE without assignToRole or assignToUserId", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_ROUTING_RULE", { name: "Bad Rule", condCategory: "MAINTENANCE" }),
    ]
    const result = await validateOperations(ops, makeSnapshot())
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("assignToRole")
  })

  it("accepts the full acceptance scenario: 2 locations + 8 departments", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Main Plant", idempotencyKey: "create-loc-main-plant" }),
      makeOp("CREATE_LOCATION", { name: "Distribution Center", idempotencyKey: "create-loc-dist" }),
      makeOp("CREATE_DEPARTMENT", { name: "Production", locationRef: "Main Plant", idempotencyKey: "dept-prod-main" }),
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Main Plant", idempotencyKey: "dept-maint-main" }),
      makeOp("CREATE_DEPARTMENT", { name: "Quality", locationRef: "Main Plant", idempotencyKey: "dept-qual-main" }),
      makeOp("CREATE_DEPARTMENT", { name: "Shipping", locationRef: "Main Plant", idempotencyKey: "dept-ship-main" }),
      makeOp("CREATE_DEPARTMENT", { name: "Production", locationRef: "Distribution Center", idempotencyKey: "dept-prod-dist" }),
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Distribution Center", idempotencyKey: "dept-maint-dist" }),
      makeOp("CREATE_DEPARTMENT", { name: "Quality", locationRef: "Distribution Center", idempotencyKey: "dept-qual-dist" }),
      makeOp("CREATE_DEPARTMENT", { name: "Shipping", locationRef: "Distribution Center", idempotencyKey: "dept-ship-dist" }),
    ]
    const result = await validateOperations(ops, makeSnapshot())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("warns on duplicate department within batch", async () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Main Plant", idempotencyKey: "d1" }),
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Main Plant", idempotencyKey: "d2" }),
    ]
    const result = await validateOperations(ops, makeSnapshot())
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes("Duplicate department"))).toBe(true)
  })
})

// ── Resolver tests ────────────────────────────────────────────────────────────

describe("resolveOperationRefs", () => {
  it("resolves locationRef to locationId for existing location", () => {
    const ctx = makeCtx({
      locations: [{ id: "loc-1", name: "Main Plant", locationType: null }],
    })
    const ops: ConfigOperation[] = [
      makeOp("CREATE_DEPARTMENT", { name: "Production", locationRef: "Main Plant" }),
    ]
    const { resolved, errors } = resolveOperationRefs(ops, ctx)
    expect(errors).toHaveLength(0)
    const deptOp = resolved[0] as { type: string; locationId?: string }
    expect(deptOp.locationId).toBe("loc-1")
  })

  it("allows locationRef for a CREATE_LOCATION in the same batch", () => {
    const ctx = makeCtx()
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "New Site" }),
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "New Site" }),
    ]
    const { errors } = resolveOperationRefs(ops, ctx)
    // Should not error — the location is batch-created
    expect(errors).toHaveLength(0)
  })

  it("errors on unknown locationRef not in batch or org", () => {
    const ctx = makeCtx()
    const ops: ConfigOperation[] = [
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Ghost Location" }),
    ]
    const { errors } = resolveOperationRefs(ops, ctx)
    expect(errors.some(e => e.includes("Ghost Location"))).toBe(true)
  })
})

// ── Preview Generator tests ───────────────────────────────────────────────────

describe("generatePreview", () => {
  it("generates a batchId and correct item count", () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Main Plant" }),
      makeOp("CREATE_DEPARTMENT", { name: "Production", locationRef: "Main Plant" }),
    ]
    const preview = generatePreview(ops, "create 2 items", [])
    expect(preview.batchId).toMatch(/^batch_/)
    expect(preview.items).toHaveLength(2)
    expect(preview.summary).toBe("create 2 items")
  })

  it("excludes EXPLAIN ops from items", () => {
    const ops: ConfigOperation[] = [
      makeOp("EXPLAIN", { field: "Company Size", idempotencyKey: "explain-1" }),
      makeOp("CREATE_LOCATION", { name: "Site A" }),
    ]
    const preview = generatePreview(ops, "explain and create", [])
    expect(preview.items).toHaveLength(1)
    expect(preview.items[0].type).toBe("CREATE_LOCATION")
  })

  it("includes warnings in preview", () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Site A" }),
    ]
    const preview = generatePreview(ops, "create site", ["Location already exists"])
    expect(preview.warnings).toHaveLength(1)
    expect(preview.warnings[0]).toBe("Location already exists")
  })

  it("generates correct labels for location and department ops", () => {
    const ops: ConfigOperation[] = [
      makeOp("CREATE_LOCATION", { name: "Main Plant", locationType: "Plant", idempotencyKey: "loc-1" }),
      makeOp("CREATE_DEPARTMENT", { name: "Maintenance", locationRef: "Main Plant", idempotencyKey: "dept-1" }),
    ]
    const preview = generatePreview(ops, "create", [])
    const locItem = preview.items.find(i => i.type === "CREATE_LOCATION")
    const deptItem = preview.items.find(i => i.type === "CREATE_DEPARTMENT")
    expect(locItem?.title).toBe("Main Plant")
    expect(locItem?.label).toBe("New Location")
    expect(deptItem?.title).toBe("Maintenance")
    expect(deptItem?.detail).toBe("at Main Plant")
  })
})

// ── Authorization test ────────────────────────────────────────────────────────

describe("operation allowlist", () => {
  it("only allows Phase 1 operation types", async () => {
    // A batch with a disallowed op type should not pass isAllowedOp
    const { isAllowedOp } = await import("@/lib/config-engine/allowlist")
    expect(isAllowedOp("CREATE_LOCATION")).toBe(true)
    expect(isAllowedOp("CREATE_DEPARTMENT")).toBe(true)
    expect(isAllowedOp("CREATE_ROUTING_RULE")).toBe(true)
    expect(isAllowedOp("DELETE_ORG")).toBe(false)
    expect(isAllowedOp("UPDATE_SUBSCRIPTION")).toBe(false)
    expect(isAllowedOp("MODIFY_BILLING")).toBe(false)
  })
})
