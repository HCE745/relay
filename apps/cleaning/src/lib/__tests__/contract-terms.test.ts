import { describe, it, expect } from "vitest"
import { Prisma } from "../../generated/prisma/client"
import { daysUntil, isExpiringSoon, contractProgress } from "../contract-terms"

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const money = (v: string) => new Prisma.Decimal(v)

describe("daysUntil", () => {
  const now = d("2026-01-01")
  it("counts whole days ahead", () => {
    expect(daysUntil(d("2026-01-31"), now)).toBe(30)
  })
  it("is zero for the same day", () => {
    expect(daysUntil(d("2026-01-01"), now)).toBe(0)
  })
  it("is negative once past", () => {
    expect(daysUntil(d("2025-12-25"), now)).toBe(-7)
  })
})

describe("isExpiringSoon", () => {
  const now = d("2026-01-01")
  it("is false with no end date (open-ended)", () => {
    expect(isExpiringSoon(null, 60, now)).toBe(false)
  })
  it("is true when the end date is within the lead window", () => {
    expect(isExpiringSoon(d("2026-02-15"), 60, now)).toBe(true) // 45 days
  })
  it("includes the boundary day", () => {
    expect(isExpiringSoon(d("2026-03-02"), 60, now)).toBe(true) // exactly 60 days
  })
  it("is false beyond the lead window", () => {
    expect(isExpiringSoon(d("2026-06-01"), 60, now)).toBe(false)
  })
  it("is false once already expired", () => {
    expect(isExpiringSoon(d("2025-12-31"), 60, now)).toBe(false)
  })
})

describe("contractProgress", () => {
  it("compares value against invoiced (the $24k vs $18.4k case)", () => {
    const p = contractProgress(money("24000"), money("18400"))
    expect(p.value?.toString()).toBe("24000")
    expect(p.invoiced.toString()).toBe("18400")
    expect(p.remaining?.toString()).toBe("5600")
    expect(p.pct).toBeCloseTo(76.7, 1)
  })
  it("returns nulls when there is no contract value", () => {
    const p = contractProgress(null, money("500"))
    expect(p.value).toBeNull()
    expect(p.remaining).toBeNull()
    expect(p.pct).toBeNull()
    expect(p.invoiced.toString()).toBe("500")
  })
  it("has null pct when value is zero (no divide-by-zero)", () => {
    const p = contractProgress(money("0"), money("0"))
    expect(p.pct).toBeNull()
    expect(p.remaining?.toString()).toBe("0")
  })
  it("goes negative when over-invoiced", () => {
    const p = contractProgress(money("1000"), money("1250"))
    expect(p.remaining?.toString()).toBe("-250")
    expect(p.remaining?.isNegative()).toBe(true)
    expect(p.pct).toBeCloseTo(125, 1)
  })
  it("reads zero invoiced for an unlinked contract", () => {
    const p = contractProgress(money("12000"), money("0"))
    expect(p.pct).toBe(0)
    expect(p.remaining?.toString()).toBe("12000")
  })
})
