import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { ORG_SCOPED_MODELS, SYSTEM_MODELS, OrgScopeError, scopeArgs } from "../org-db"

// ─── Structural guardrail (the real fix) ─────────────────────────────────────
// Tenant isolation must be the DEFAULT; "unscoped" must be a conscious, stated
// choice — never an omission. Every Prisma model is partitioned by whether it
// has an `organizationId` column: with → MUST be in ORG_SCOPED_MODELS; without
// → MUST be in SYSTEM_MODELS (the deliberately-system allowlist). A new model
// added without classifying it fails this test loudly.

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/schema.prisma")
const schema = readFileSync(schemaPath, "utf8")

function parseModels(): { name: string; hasOrg: boolean }[] {
  const out: { name: string; hasOrg: boolean }[] = []
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(schema))) {
    out.push({ name: m[1], hasOrg: /^\s*organizationId\s+String/m.test(m[2]) })
  }
  return out
}

describe("model scoping is exhaustive (no model unprotected by omission)", () => {
  const models = parseModels()

  it("parses the schema", () => {
    expect(models.length).toBeGreaterThan(30)
  })

  it("EVERY model with organizationId is in ORG_SCOPED_MODELS", () => {
    const withOrg = models.filter((m) => m.hasOrg).map((m) => m.name).sort()
    const scoped = [...ORG_SCOPED_MODELS].sort()
    // Fails loudly naming any org-bearing model missing from the scoped set.
    expect(scoped).toEqual(withOrg)
  })

  it("EVERY model without organizationId is in the SYSTEM_MODELS allowlist", () => {
    const withoutOrg = models.filter((m) => !m.hasOrg).map((m) => m.name).sort()
    const system = [...SYSTEM_MODELS].sort()
    expect(system).toEqual(withoutOrg)
  })

  it("the two sets are disjoint and cover every model", () => {
    const all = models.map((m) => m.name).sort()
    const union = [...ORG_SCOPED_MODELS, ...SYSTEM_MODELS].sort()
    expect([...ORG_SCOPED_MODELS].filter((m) => SYSTEM_MODELS.has(m))).toEqual([])
    expect(union).toEqual(all)
  })

  it("no stale entries: every ORG_SCOPED_MODELS member actually exists and has organizationId", () => {
    const orgBearing = new Set(models.filter((m) => m.hasOrg).map((m) => m.name))
    for (const m of ORG_SCOPED_MODELS) expect(orgBearing.has(m), `${m} should exist with organizationId`).toBe(true)
  })
})

describe("every scoped model enforces isolation at the mechanism level", () => {
  const org = "org-1"
  for (const model of ORG_SCOPED_MODELS) {
    it(`${model}: reads inject organizationId; by-id writes/reads are blocked`, () => {
      // READ: findMany is org-scoped
      const read = scopeArgs(model, "findMany", { where: { x: 1 } }, org) as { where: { AND: unknown[] } }
      expect(read.where.AND).toContainEqual({ organizationId: org })
      // by-id UPDATE/DELETE via *Many ARE scoped (the safe path)
      const upd = scopeArgs(model, "updateMany", { where: { id: "foreign" } }, org) as { where: { AND: unknown[] } }
      expect(upd.where.AND).toContainEqual({ organizationId: org })
      const del = scopeArgs(model, "deleteMany", { where: { id: "foreign" } }, org) as { where: { AND: unknown[] } }
      expect(del.where.AND).toContainEqual({ organizationId: org })
      // by-unique ops are BLOCKED (their where can't carry organizationId)
      expect(() => scopeArgs(model, "findUnique", { where: { id: "x" } }, org)).toThrow(OrgScopeError)
      expect(() => scopeArgs(model, "update", { where: { id: "x" }, data: {} }, org)).toThrow(OrgScopeError)
      expect(() => scopeArgs(model, "delete", { where: { id: "x" } }, org)).toThrow(OrgScopeError)
      expect(() => scopeArgs(model, "upsert", { where: { id: "x" }, create: {}, update: {} }, org)).toThrow(OrgScopeError)
      // CREATE forces the org into data
      const cre = scopeArgs(model, "create", { data: { a: 1 } }, org) as { data: Record<string, unknown> }
      expect(cre.data.organizationId).toBe(org)
    })
  }
})
