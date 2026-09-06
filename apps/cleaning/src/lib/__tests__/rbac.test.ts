import { describe, it, expect } from "vitest"
import {
  experienceForRole,
  canAccessAdminRoute,
  navForRole,
  landingPathForRole,
  canViewSchedule,
  canManageSchedule,
  canManageOrg,
  ADMIN_NAV,
} from "../rbac"

describe("schedule + org permissions", () => {
  it("canViewSchedule: managers + supervisors, not cleaners", () => {
    for (const r of ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"]) expect(canViewSchedule(r)).toBe(true)
    expect(canViewSchedule("CLEANER")).toBe(false)
  })
  it("canManageSchedule: managers only, not supervisor/cleaner", () => {
    for (const r of ["OWNER", "ADMIN", "MANAGER"]) expect(canManageSchedule(r)).toBe(true)
    expect(canManageSchedule("SUPERVISOR")).toBe(false)
    expect(canManageSchedule("CLEANER")).toBe(false)
  })
  it("canManageOrg: owner/admin only", () => {
    expect(canManageOrg("OWNER")).toBe(true)
    expect(canManageOrg("ADMIN")).toBe(true)
    expect(canManageOrg("MANAGER")).toBe(false)
    expect(canManageOrg("SUPERVISOR")).toBe(false)
    expect(canManageOrg("CLEANER")).toBe(false)
  })
})

describe("experience routing", () => {
  it("cleaners get the field experience; everyone else gets admin", () => {
    expect(experienceForRole("CLEANER")).toBe("field")
    for (const r of ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"]) {
      expect(experienceForRole(r)).toBe("admin")
    }
  })

  it("landing path matches the experience", () => {
    expect(landingPathForRole("CLEANER")).toBe("/today")
    expect(landingPathForRole("SUPERVISOR")).toBe("/dashboard")
    expect(landingPathForRole("OWNER")).toBe("/dashboard")
  })
})

describe("admin route access matrix", () => {
  it("owner and admin can access every admin route", () => {
    for (const item of ADMIN_NAV) {
      expect(canAccessAdminRoute("OWNER", item.key)).toBe(true)
      expect(canAccessAdminRoute("ADMIN", item.key)).toBe(true)
    }
  })

  it("supervisor is limited to operational routes", () => {
    expect(canAccessAdminRoute("SUPERVISOR", "dashboard")).toBe(true)
    expect(canAccessAdminRoute("SUPERVISOR", "jobs")).toBe(true)
    expect(canAccessAdminRoute("SUPERVISOR", "inspections")).toBe(true)
    // Not permitted for supervisors:
    expect(canAccessAdminRoute("SUPERVISOR", "customers")).toBe(false)
    expect(canAccessAdminRoute("SUPERVISOR", "team")).toBe(false)
    expect(canAccessAdminRoute("SUPERVISOR", "settings")).toBe(false)
    expect(canAccessAdminRoute("SUPERVISOR", "reports")).toBe(false)
  })

  it("manager gets most routes but not settings", () => {
    expect(canAccessAdminRoute("MANAGER", "customers")).toBe(true)
    expect(canAccessAdminRoute("MANAGER", "reports")).toBe(true)
    expect(canAccessAdminRoute("MANAGER", "settings")).toBe(false)
  })

  it("cleaners have no admin routes", () => {
    for (const item of ADMIN_NAV) {
      expect(canAccessAdminRoute("CLEANER", item.key)).toBe(false)
    }
  })

  it("unknown role is denied", () => {
    expect(canAccessAdminRoute("ROBOT", "dashboard")).toBe(false)
  })
})

describe("navForRole is independent from RBAC vs capability", () => {
  const allCaps = () => true
  const noCaps = () => false

  it("RBAC filters first: supervisor never sees customers even with all capabilities", () => {
    const nav = navForRole("SUPERVISOR", allCaps)
    expect(nav.map((n) => n.key)).not.toContain("customers")
    expect(nav.map((n) => n.key)).toContain("jobs")
  })

  it("capability filters second: admin loses capability-gated items when the plan lacks them", () => {
    const nav = navForRole("ADMIN", noCaps)
    // Dashboard and Settings have no requiredCap, so they survive.
    expect(nav.map((n) => n.key)).toEqual(["dashboard", "settings"])
  })

  it("admin with all capabilities sees the full nav", () => {
    const nav = navForRole("ADMIN", allCaps)
    expect(nav.length).toBe(ADMIN_NAV.length)
  })
})
