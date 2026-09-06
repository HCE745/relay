import { describe, it, expect } from "vitest"
import { scopeArgs, OrgScopeError, ORG_SCOPED_MODELS } from "../org-db"

const ORG = "org-1"
type WhereArgs = { where: { AND: unknown[] } }
type DataArgs = { data: { organizationId: string } }
type DataArrayArgs = { data: Array<{ organizationId: string }> }

describe("scopeArgs — reads", () => {
  it("AND-injects organizationId into findMany where", () => {
    const out = scopeArgs("Customer", "findMany", { where: { isActive: true } }, ORG) as WhereArgs
    expect(out.where).toEqual({ AND: [{ organizationId: ORG }, { isActive: true }] })
  })

  it("scopes findFirst even with only an id filter (cross-org id returns nothing)", () => {
    const out = scopeArgs("Customer", "findFirst", { where: { id: "x" } }, ORG) as WhereArgs
    expect(out.where.AND).toEqual([{ organizationId: ORG }, { id: "x" }])
  })

  it("a client-supplied organizationId cannot widen scope (AND makes it match nothing)", () => {
    const out = scopeArgs("Customer", "findMany", { where: { organizationId: "other-org" } }, ORG) as WhereArgs
    expect(out.where.AND).toEqual([{ organizationId: ORG }, { organizationId: "other-org" }])
  })

  it("handles missing where (count)", () => {
    const out = scopeArgs("Customer", "count", undefined, ORG) as WhereArgs
    expect(out.where).toEqual({ AND: [{ organizationId: ORG }] })
  })
})

describe("scopeArgs — writes", () => {
  it("forces organizationId on create, overriding any client value", () => {
    const out = scopeArgs("Customer", "create", { data: { name: "n", organizationId: "spoof" } }, ORG) as DataArgs
    expect(out.data.organizationId).toBe(ORG)
  })

  it("forces organizationId on every createMany row", () => {
    const out = scopeArgs("Contact", "createMany", { data: [{ name: "a" }, { name: "b", organizationId: "spoof" }] }, ORG) as DataArrayArgs
    expect(out.data.every((d) => d.organizationId === ORG)).toBe(true)
  })

  it("AND-injects organizationId into updateMany/deleteMany where", () => {
    const upd = scopeArgs("Customer", "updateMany", { where: { id: "x" }, data: { name: "n" } }, ORG) as WhereArgs
    expect(upd.where.AND).toEqual([{ organizationId: ORG }, { id: "x" }])
    const del = scopeArgs("Contact", "deleteMany", { where: { id: "y" } }, ORG) as WhereArgs
    expect(del.where.AND).toEqual([{ organizationId: ORG }, { id: "y" }])
  })
})

describe("scopeArgs — blocked by-unique operations", () => {
  for (const op of ["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]) {
    it(`throws OrgScopeError for ${op} on a tenant model`, () => {
      expect(() => scopeArgs("Customer", op, { where: { id: "x" } }, ORG)).toThrow(OrgScopeError)
    })
  }
})

describe("scopeArgs — non-tenant models pass through untouched", () => {
  it("Organization is not auto-scoped (it is the tenant root)", () => {
    expect(ORG_SCOPED_MODELS.has("Organization")).toBe(false)
    const args = { where: { id: "org-x" } }
    expect(scopeArgs("Organization", "findUnique", args, ORG)).toBe(args)
  })

  it("ChecklistTemplateItem (parent-scoped) passes through", () => {
    const args = { where: { templateId: "t" } }
    expect(scopeArgs("ChecklistTemplateItem", "findMany", args, ORG)).toBe(args)
  })
})
