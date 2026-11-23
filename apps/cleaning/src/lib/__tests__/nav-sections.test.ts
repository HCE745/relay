import { describe, it, expect } from "vitest"
import { ADMIN_NAV, NAV_SECTIONS, navForRole } from "../rbac"

// The ERP shell groups every destination under the seven workspaces. These
// invariants keep the sidebar headers and the per-workspace secondary nav
// correct: every item is in a known section, and each section's items are
// contiguous (the sidebar prints a header above the first item of a run, and the
// sub-nav lists a section's siblings — both assume no section is interleaved).

describe("admin nav sections", () => {
  it("every nav item declares a known workspace section", () => {
    for (const item of ADMIN_NAV) {
      expect(item.section, `${item.label} has no section`).toBeTruthy()
      expect(NAV_SECTIONS as readonly string[]).toContain(item.section!)
    }
  })

  it("all seven workspaces are represented", () => {
    const used = new Set(ADMIN_NAV.map((i) => i.section))
    for (const s of NAV_SECTIONS) expect(used.has(s), `${s} has no items`).toBe(true)
  })

  it("each section's items are contiguous (never interleaved)", () => {
    const seen = new Set<string>()
    let prev: string | undefined
    for (const item of ADMIN_NAV) {
      if (item.section !== prev) {
        // Entering a (new) run: that section must not have appeared before.
        expect(seen.has(item.section!), `${item.section} is split into two runs`).toBe(false)
        seen.add(item.section!)
        prev = item.section
      }
    }
  })

  it("sections appear in the canonical order", () => {
    const order = ADMIN_NAV.map((i) => i.section).filter((s, i, a) => s !== a[i - 1])
    expect(order).toEqual([...NAV_SECTIONS])
  })

  it("filtering by role/capability preserves each item's section", () => {
    const nav = navForRole("OWNER", () => true)
    for (const item of nav) expect(NAV_SECTIONS as readonly string[]).toContain(item.section!)
  })
})
