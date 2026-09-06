import { describe, it, expect } from "vitest"
import { scopeWhere, scopeCreate, assertOrg, forOrg } from "../org-scope"

describe("scopeWhere", () => {
  it("injects the org filter", () => {
    expect(scopeWhere("org-1", { isActive: true })).toEqual({ isActive: true, organizationId: "org-1" })
  })

  it("overrides a caller-supplied organizationId (cannot widen scope)", () => {
    const malicious = { organizationId: "org-victim", name: "x" }
    expect(scopeWhere("org-1", malicious).organizationId).toBe("org-1")
  })

  it("works with no where clause", () => {
    expect(scopeWhere("org-1")).toEqual({ organizationId: "org-1" })
  })
})

describe("scopeCreate", () => {
  it("forces the org on created rows regardless of input", () => {
    expect(scopeCreate("org-1", { name: "n", organizationId: "spoofed" }).organizationId).toBe("org-1")
  })
})

describe("assertOrg", () => {
  it("returns the record when it belongs to the org", () => {
    const rec = { organizationId: "org-1", id: "a" }
    expect(assertOrg("org-1", rec)).toBe(rec)
  })
  it("returns null for a cross-org record", () => {
    expect(assertOrg("org-1", { organizationId: "org-2", id: "a" })).toBeNull()
  })
  it("passes through null/undefined", () => {
    expect(assertOrg("org-1", null)).toBeNull()
    expect(assertOrg("org-1", undefined)).toBeNull()
  })
})

describe("forOrg", () => {
  it("binds an org id across helpers", () => {
    const scope = forOrg("org-9")
    expect(scope.where({ a: 1 })).toEqual({ a: 1, organizationId: "org-9" })
    expect(scope.create({ b: 2 })).toEqual({ b: 2, organizationId: "org-9" })
    expect(scope.assert({ organizationId: "org-9", id: "x" })).not.toBeNull()
    expect(scope.assert({ organizationId: "other", id: "x" })).toBeNull()
  })
})
