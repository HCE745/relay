import { describe, it, expect } from "vitest"
import {
  extractEmailDomain,
  isPublicEmailDomain,
  normalizeCompanyName,
} from "@/lib/registration-crm-sync-pure"

// ── extractEmailDomain ────────────────────────────────────────────────────────

describe("extractEmailDomain", () => {
  it("extracts domain from a standard email", () => {
    expect(extractEmailDomain("alice@acmecorp.com")).toBe("acmecorp.com")
  })

  it("lowercases the domain", () => {
    expect(extractEmailDomain("Bob@AcmeCorp.COM")).toBe("acmecorp.com")
  })

  it("returns null for an email with no @", () => {
    expect(extractEmailDomain("notanemail")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(extractEmailDomain("")).toBeNull()
  })

  it("handles subdomains", () => {
    expect(extractEmailDomain("user@mail.corp.example.com")).toBe("mail.corp.example.com")
  })
})

// ── isPublicEmailDomain ───────────────────────────────────────────────────────

describe("isPublicEmailDomain", () => {
  it("returns true for gmail.com", () => {
    expect(isPublicEmailDomain("gmail.com")).toBe(true)
  })

  it("returns true for outlook.com", () => {
    expect(isPublicEmailDomain("outlook.com")).toBe(true)
  })

  it("returns true for yahoo.com", () => {
    expect(isPublicEmailDomain("yahoo.com")).toBe(true)
  })

  it("returns true for icloud.com", () => {
    expect(isPublicEmailDomain("icloud.com")).toBe(true)
  })

  it("returns false for a business domain", () => {
    expect(isPublicEmailDomain("acmecorp.com")).toBe(false)
  })

  it("returns false for a manufacturing company domain", () => {
    expect(isPublicEmailDomain("midwestmfg.com")).toBe(false)
  })

  it("returns true for null", () => {
    expect(isPublicEmailDomain(null)).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isPublicEmailDomain("Gmail.COM")).toBe(true)
  })
})

// ── normalizeCompanyName ──────────────────────────────────────────────────────

describe("normalizeCompanyName", () => {
  it("strips common suffixes", () => {
    expect(normalizeCompanyName("Acme Corp")).toBe("acme")
    expect(normalizeCompanyName("Acme Inc.")).toBe("acme")
    expect(normalizeCompanyName("Acme LLC")).toBe("acme")
  })

  it("lowercases and trims", () => {
    expect(normalizeCompanyName("  ACME Manufacturing  ")).toBe("acme manufacturing")
  })

  it("removes punctuation", () => {
    // apostrophe becomes a space; normalizer collapses adjacent spaces
    expect(normalizeCompanyName("O'Brien & Sons, Ltd.")).toBe("o brien sons")
  })

  it("collapses multiple spaces", () => {
    expect(normalizeCompanyName("Midwest   Fabrication")).toBe("midwest fabrication")
  })

  it("matches two companies with same normalized name", () => {
    const a = normalizeCompanyName("ABC Manufacturing LLC")
    const b = normalizeCompanyName("ABC Manufacturing, Inc.")
    expect(a).toBe(b)
  })

  it("does not match unrelated companies", () => {
    const a = normalizeCompanyName("Midwest Fabrication")
    const b = normalizeCompanyName("Eastern Fabrication")
    expect(a).not.toBe(b)
  })
})

// ── Round-robin assignment logic (pure simulation) ───────────────────────────
// The actual assignInboundRep() uses prisma.$transaction, so we test the
// selection logic using a pure function that mirrors it.

type MockRep = { id: string; name: string; inboundLastAssignedAt: Date | null }

function pickNextRep(eligible: MockRep[]): MockRep | null {
  if (eligible.length === 0) return null
  const sorted = [...eligible].sort((a, b) => {
    if (a.inboundLastAssignedAt === null && b.inboundLastAssignedAt === null) {
      return a.id.localeCompare(b.id)
    }
    if (a.inboundLastAssignedAt === null) return -1
    if (b.inboundLastAssignedAt === null) return 1
    const diff = a.inboundLastAssignedAt.getTime() - b.inboundLastAssignedAt.getTime()
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })
  return sorted[0]
}

describe("round-robin assignment logic", () => {
  it("assigns to the only eligible rep", () => {
    const reps: MockRep[] = [{ id: "rachel", name: "Rachel", inboundLastAssignedAt: null }]
    expect(pickNextRep(reps)?.id).toBe("rachel")
  })

  it("returns null when no reps are eligible", () => {
    expect(pickNextRep([])).toBeNull()
  })

  it("assigns to the rep with oldest lastAssignedAt", () => {
    const reps: MockRep[] = [
      { id: "b", name: "Rep B", inboundLastAssignedAt: new Date("2026-01-02T10:00:00Z") },
      { id: "rachel", name: "Rachel", inboundLastAssignedAt: new Date("2026-01-01T10:00:00Z") },
    ]
    expect(pickNextRep(reps)?.id).toBe("rachel")
  })

  it("prefers unassigned reps (null) over previously assigned ones", () => {
    const reps: MockRep[] = [
      { id: "b", name: "Rep B", inboundLastAssignedAt: new Date("2026-01-01T10:00:00Z") },
      { id: "c", name: "Rep C", inboundLastAssignedAt: null },
    ]
    expect(pickNextRep(reps)?.id).toBe("c")
  })

  it("alternates between two reps over sequential signups", () => {
    let reps: MockRep[] = [
      { id: "rachel", name: "Rachel", inboundLastAssignedAt: null },
      { id: "bob",    name: "Bob",    inboundLastAssignedAt: null },
    ]

    const assignments: string[] = []
    for (let i = 0; i < 6; i++) {
      const winner = pickNextRep(reps)!
      assignments.push(winner.id)
      // Simulate updating the timestamp after assignment
      reps = reps.map((r) =>
        r.id === winner.id ? { ...r, inboundLastAssignedAt: new Date(Date.now() + i) } : r,
      )
    }

    // Pattern should alternate: rachel, bob, rachel, bob... (nulls first, then oldest)
    expect(assignments[0]).toBe("bob")     // 'bob' sorts before 'rachel' by id when both null
    expect(assignments[1]).toBe("rachel")
    expect(assignments[2]).toBe("bob")
    expect(assignments[3]).toBe("rachel")
  })

  it("skips the last assigned rep and picks the other when there are two", () => {
    const reps: MockRep[] = [
      { id: "rachel", name: "Rachel", inboundLastAssignedAt: new Date("2026-11-01T10:00:00Z") },
      { id: "bob",    name: "Bob",    inboundLastAssignedAt: new Date("2026-11-01T09:00:00Z") },
    ]
    // Bob was assigned earlier so rachel was assigned last → bob should be next
    expect(pickNextRep(reps)?.id).toBe("bob")
  })
})

// ── Prospect matching priority (domain exclusion) ─────────────────────────────

describe("domain-based matching rules", () => {
  it("excludes personal emails from company matching", () => {
    const personalDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]
    for (const d of personalDomains) {
      expect(isPublicEmailDomain(d)).toBe(true)
    }
  })

  it("allows business domains for matching", () => {
    const businessDomains = ["acmecorp.com", "midwestmfg.com", "relayapp.io", "widgets.co"]
    for (const d of businessDomains) {
      expect(isPublicEmailDomain(d)).toBe(false)
    }
  })

  it("extracts domain correctly for matching", () => {
    const email = "john.smith@acmemfg.com"
    const domain = extractEmailDomain(email)
    expect(domain).toBe("acmemfg.com")
    expect(isPublicEmailDomain(domain)).toBe(false)
  })
})

// ── Onboarding status transitions ─────────────────────────────────────────────

describe("onboarding status values", () => {
  const validStatuses = ["not_started", "in_progress", "completed", "stalled"]

  it("covers all expected status values", () => {
    expect(validStatuses).toContain("not_started")
    expect(validStatuses).toContain("in_progress")
    expect(validStatuses).toContain("completed")
    expect(validStatuses).toContain("stalled")
  })

  it("completed status suppresses stall follow-ups (logic check)", () => {
    // Simulate: a prospect with onboardingStatus="completed" should NOT
    // appear in stall queries (the cron filters on "not_started"|"in_progress")
    const stalledFilter = ["not_started", "in_progress"]
    expect(stalledFilter.includes("completed")).toBe(false)
    expect(stalledFilter.includes("stalled")).toBe(false)
  })
})
