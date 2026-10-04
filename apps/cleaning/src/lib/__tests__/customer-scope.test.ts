import { describe, it, expect } from "vitest"
import { scopeCustomerArgs, OrgScopeError } from "../org-db"

// Pure isolation logic for the customer-portal client (Phase 16): org AND
// customer predicates are forced into every where; writes, by-unique ops and
// non-portal models throw.
describe("scopeCustomerArgs", () => {
  it("AND-s org + customer (direct customerId model) into where", () => {
    const out = scopeCustomerArgs("Invoice", "findMany", { where: { status: "SENT" } }, "org1", "custA") as { where: { AND: unknown[] } }
    expect(out.where.AND).toEqual([{ organizationId: "org1" }, { customerId: "custA" }, { status: "SENT" }])
  })

  it("scopes relation-based models via serviceLocation.customerId", () => {
    const out = scopeCustomerArgs("Job", "findFirst", { where: { id: "jobB" } }, "org1", "custA") as { where: { AND: unknown[] } }
    expect(out.where.AND).toEqual([{ organizationId: "org1" }, { serviceLocation: { customerId: "custA" } }, { id: "jobB" }])
  })

  it("a findFirst by another customer's id still carries the customer predicate (→ matches nothing)", () => {
    const out = scopeCustomerArgs("Inspection", "findFirst", { where: { id: "inspB" } }, "org1", "custA") as { where: { AND: Array<Record<string, unknown>> } }
    expect(out.where.AND).toContainEqual({ serviceLocation: { customerId: "custA" } })
    expect(out.where.AND).toContainEqual({ id: "inspB" })
  })

  it("JobPhoto is scoped via job OR inspection ownership", () => {
    const out = scopeCustomerArgs("JobPhoto", "findFirst", { where: { id: "p" } }, "org1", "custA") as { where: { AND: Array<Record<string, unknown>> } }
    expect(out.where.AND).toContainEqual({ OR: [{ job: { serviceLocation: { customerId: "custA" } } }, { inspection: { serviceLocation: { customerId: "custA" } } }] })
  })

  it("blocks writes on the read-only portal client", () => {
    expect(() => scopeCustomerArgs("Issue", "create", { data: {} }, "o", "c")).toThrow(OrgScopeError)
    expect(() => scopeCustomerArgs("Invoice", "updateMany", {}, "o", "c")).toThrow(OrgScopeError)
    expect(() => scopeCustomerArgs("Invoice", "deleteMany", {}, "o", "c")).toThrow(OrgScopeError)
  })

  it("blocks by-unique ops (findUnique) whose where can't carry the predicate", () => {
    expect(() => scopeCustomerArgs("Invoice", "findUnique", { where: { id: "x" } }, "o", "c")).toThrow(OrgScopeError)
  })

  it("blocks non-portal models entirely (e.g. pay data never reachable)", () => {
    expect(() => scopeCustomerArgs("EmployeeProfile", "findMany", {}, "o", "c")).toThrow(OrgScopeError)
    expect(() => scopeCustomerArgs("TimeEntry", "findMany", {}, "o", "c")).toThrow(OrgScopeError)
    expect(() => scopeCustomerArgs("User", "findMany", {}, "o", "c")).toThrow(OrgScopeError)
  })
})
