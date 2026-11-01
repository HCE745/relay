import { describe, it, expect } from "vitest"
import { dec, ZERO } from "../billing-math"
import { periodDays, prorate, variance } from "../labor-budgets"

describe("periodDays", () => {
  it("weekly is 7, monthly is 30", () => {
    expect(periodDays("WEEKLY")).toBe(7)
    expect(periodDays("MONTHLY")).toBe(30)
  })
})

describe("prorate", () => {
  it("scales a monthly budget to the report length", () => {
    expect(prorate(dec("3000"), "MONTHLY", 30).toString()).toBe("3000")
    expect(prorate(dec("3000"), "MONTHLY", 15).toString()).toBe("1500")
  })
  it("scales a weekly budget", () => {
    expect(prorate(dec("40"), "WEEKLY", 14).toString()).toBe("80")
  })
  it("is zero for a non-positive range", () => {
    expect(prorate(dec("100"), "WEEKLY", 0).isZero()).toBe(true)
  })
})

describe("variance", () => {
  it("reports over budget as a positive variance and >100% used", () => {
    const v = variance(dec("100"), dec("120"))
    expect(v.variance.toString()).toBe("20")
    expect(v.pctUsed).toBe(120)
  })
  it("reports under budget as a negative variance", () => {
    const v = variance(dec("100"), dec("80"))
    expect(v.variance.toString()).toBe("-20")
    expect(v.pctUsed).toBe(80)
  })
  it("has a null pctUsed when the budget is zero", () => {
    const v = variance(ZERO, dec("50"))
    expect(v.pctUsed).toBeNull()
    expect(v.variance.toString()).toBe("50")
  })
})
