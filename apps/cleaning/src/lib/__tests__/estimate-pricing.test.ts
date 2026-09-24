import { describe, it, expect } from "vitest"
import { Prisma } from "../../generated/prisma/client"
import { lineAmount, estimateTotal, planPricingFromEstimate } from "../estimate-pricing"

const d = (v: string | number) => new Prisma.Decimal(v)

describe("lineAmount / estimateTotal", () => {
  it("amount = quantity × unit rate (2 dp)", () => {
    expect(lineAmount(d(3), d(40)).toFixed(2)).toBe("120.00")
    expect(lineAmount(d("2.5"), d("19.99")).toFixed(2)).toBe("49.98") // 49.975 → 49.98
  })
  it("total sums line amounts", () => {
    expect(estimateTotal([{ amount: d(120) }, { amount: d("49.98") }]).toFixed(2)).toBe("169.98")
    expect(estimateTotal([]).toFixed(2)).toBe("0.00")
  })
})

describe("planPricingFromEstimate — estimate pricing → plan billingType/rate", () => {
  it("PER_VISIT → FLAT_PER_JOB, rate = the total when no explicit rate", () => {
    const r = planPricingFromEstimate({ pricing: "PER_VISIT", rate: null, total: d(300) })
    expect(r.billingType).toBe("FLAT_PER_JOB")
    expect(r.rate.toFixed(2)).toBe("300.00")
  })
  it("PER_VISIT → an explicit per-visit rate wins over the total", () => {
    const r = planPricingFromEstimate({ pricing: "PER_VISIT", rate: d(250), total: d(300) })
    expect(r.billingType).toBe("FLAT_PER_JOB")
    expect(r.rate.toFixed(2)).toBe("250.00")
  })
  it("HOURLY → HOURLY, rate = the hourly rate", () => {
    const r = planPricingFromEstimate({ pricing: "HOURLY", rate: d(40), total: d(320) })
    expect(r.billingType).toBe("HOURLY")
    expect(r.rate.toFixed(2)).toBe("40.00")
  })

  it("PER_VISIT with no price → refuses (says so, doesn't guess)", () => {
    expect(() => planPricingFromEstimate({ pricing: "PER_VISIT", rate: null, total: d(0) })).toThrow(/no price to bill/i)
  })
  it("HOURLY with no hourly rate → refuses (never assumes the total is the rate)", () => {
    expect(() => planPricingFromEstimate({ pricing: "HOURLY", rate: null, total: d(320) })).toThrow(/hourly rate/i)
    expect(() => planPricingFromEstimate({ pricing: "HOURLY", rate: d(0), total: d(320) })).toThrow(/hourly rate/i)
  })
  it("unknown pricing shape → refuses", () => {
    expect(() => planPricingFromEstimate({ pricing: "WEIRD", rate: d(1), total: d(1) })).toThrow(/can't map/i)
  })
})
