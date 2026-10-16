import { describe, it, expect } from "vitest"
import { crewBand, bandValue, computeEarning, resolvePayRule } from "../data/commission"
import { dec } from "../billing-math"

describe("crewBand", () => {
  it("maps crew size to solo / pair / crew(3+)", () => {
    expect(crewBand(1)).toBe("solo")
    expect(crewBand(2)).toBe("pair")
    expect(crewBand(3)).toBe("crew")
    expect(crewBand(6)).toBe("crew")
  })
})

describe("bandValue", () => {
  it("picks the band value, falling back to solo when a band is unset", () => {
    const rule = { soloValue: dec("40"), pairValue: null, crewValue: dec("20") }
    expect(bandValue(rule, 1)!.toString()).toBe("40")
    expect(bandValue(rule, 2)!.toString()).toBe("40") // pair unset → solo
    expect(bandValue(rule, 4)!.toString()).toBe("20")
  })
})

describe("computeEarning — the 40% solo / 25% paired example, both readings", () => {
  it("PERCENT per person: each crew member gets the full band percent", () => {
    const r = computeEarning({ basis: "PERCENT_OF_JOB_REVENUE", split: "PER_PERSON", value: dec("25"), billable: dec("300"), crewSize: 2 })
    expect(r?.amount.toString()).toBe("75") // 25% of 300, each
    expect(r?.status).toBe("CALCULATED")
  })
  it("PERCENT split across crew: the pool is divided", () => {
    const r = computeEarning({ basis: "PERCENT_OF_JOB_REVENUE", split: "SPLIT_ACROSS_CREW", value: dec("25"), billable: dec("300"), crewSize: 2 })
    expect(r?.amount.toString()).toBe("37.5") // (25% of 300) / 2
  })
  it("solo percent applies the solo band", () => {
    const r = computeEarning({ basis: "PERCENT_OF_JOB_REVENUE", split: "PER_PERSON", value: dec("40"), billable: dec("300"), crewSize: 1 })
    expect(r?.amount.toString()).toBe("120")
  })
})

describe("computeEarning — flat + edge cases", () => {
  it("FLAT per person pays the flat; split divides it", () => {
    expect(computeEarning({ basis: "FLAT_PER_JOB", split: "PER_PERSON", value: dec("30"), billable: dec("300"), crewSize: 3 })?.amount.toString()).toBe("30")
    expect(computeEarning({ basis: "FLAT_PER_JOB", split: "SPLIT_ACROSS_CREW", value: dec("30"), billable: dec("300"), crewSize: 3 })?.amount.toString()).toBe("10")
  })
  it("FLAT needs no billable amount", () => {
    expect(computeEarning({ basis: "FLAT_PER_JOB", split: "PER_PERSON", value: dec("30"), billable: null, crewSize: 1 })?.status).toBe("CALCULATED")
  })
  it("PERCENT with no billable is PENDING (amount 0), awaiting the invoice", () => {
    const r = computeEarning({ basis: "PERCENT_OF_JOB_REVENUE", split: "PER_PERSON", value: dec("25"), billable: null, crewSize: 1 })
    expect(r?.status).toBe("PENDING")
    expect(r?.amount.toString()).toBe("0")
  })
  it("PERCENT with voided revenue is VOIDED, not merely pending", () => {
    expect(computeEarning({ basis: "PERCENT_OF_JOB_REVENUE", split: "PER_PERSON", value: dec("25"), billable: null, crewSize: 1, voidedRevenue: true })?.status).toBe("VOIDED")
  })
  it("HOURLY basis returns null (handled by the time/labor system)", () => {
    expect(computeEarning({ basis: "HOURLY", split: "PER_PERSON", value: null, billable: dec("300"), crewSize: 1 })).toBeNull()
  })
})

describe("resolvePayRule — most specific, most recent wins", () => {
  const base = { splitMode: "PER_PERSON" as const, soloValue: dec("1"), pairValue: null, crewValue: null, customerId: null, serviceLocationId: null, servicePlanId: null, isActive: true, basis: "PERCENT_OF_JOB_REVENUE" as const }
  const onDate = new Date("2026-06-01")
  const ctx = { userId: "u1", role: "CLEANER", customerId: "c1", serviceLocationId: "s1", servicePlanId: "p1", onDate }

  it("an employee rule beats a role rule", () => {
    const rules = [
      { ...base, id: "role", userId: null, role: "CLEANER", effectiveFrom: new Date("2026-01-01") },
      { ...base, id: "emp", userId: "u1", role: null, effectiveFrom: new Date("2026-01-01") },
    ]
    expect(resolvePayRule(rules, ctx)?.id).toBe("emp")
  })
  it("a site override beats a general role rule", () => {
    const rules = [
      { ...base, id: "general", userId: null, role: "CLEANER", effectiveFrom: new Date("2026-01-01") },
      { ...base, id: "site", userId: null, role: "CLEANER", serviceLocationId: "s1", effectiveFrom: new Date("2026-01-01") },
    ]
    expect(resolvePayRule(rules, ctx)?.id).toBe("site")
  })
  it("ignores rules not yet effective, and picks the latest among ties", () => {
    const rules = [
      { ...base, id: "future", userId: "u1", role: null, effectiveFrom: new Date("2026-09-01") },
      { ...base, id: "old", userId: "u1", role: null, effectiveFrom: new Date("2026-01-01") },
      { ...base, id: "newer", userId: "u1", role: null, effectiveFrom: new Date("2026-03-01") },
    ]
    expect(resolvePayRule(rules, ctx)?.id).toBe("newer")
  })
  it("returns null when nothing matches the worker", () => {
    const rules = [{ ...base, id: "other", userId: "other", role: null, effectiveFrom: new Date("2026-01-01") }]
    expect(resolvePayRule(rules, ctx)).toBeNull()
  })
})
