import { describe, it, expect } from "vitest"
import { computeBid } from "../bid-math"

const base = { laborRate: "35", suppliesPct: "8", overheadPct: "15", targetMarginPct: "30" }

describe("computeBid", () => {
  it("prices a single weekly area through the full calculation", () => {
    const r = computeBid({ ...base, areas: [{ name: "Lobby", sqft: 10000, surfaceType: "Carpet", sqftPerHour: 5000, frequency: "WEEKLY" }] })
    expect(r.areas[0].hoursPerVisit).toBe("2") // 10000/5000
    expect(r.monthlyHours).toBe("8.66") // 2 × 4.33
    expect(r.laborCost).toBe("303.1")
    expect(r.suppliesCost).toBe("24.25")
    expect(r.overheadCost).toBe("49.1")
    expect(r.totalCost).toBe("376.45")
    expect(r.price).toBe("537.79") // cost / 0.7
    expect(r.margin).toBe("161.34")
    expect(r.marginPct).toBe("30")
  })

  it("sums multiple areas", () => {
    const r = computeBid({
      ...base,
      areas: [
        { name: "A", sqft: 5000, surfaceType: "X", sqftPerHour: 5000, frequency: "MONTHLY" }, // 1h ×1 = 1
        { name: "B", sqft: 5000, surfaceType: "Y", sqftPerHour: 5000, frequency: "MONTHLY" }, // 1h ×1 = 1
      ],
    })
    expect(r.monthlyHours).toBe("2")
  })

  it("guards divide-by-zero on a zero production rate", () => {
    const r = computeBid({ ...base, areas: [{ name: "Z", sqft: 1000, surfaceType: "X", sqftPerHour: 0, frequency: "WEEKLY" }] })
    expect(r.areas[0].hoursPerVisit).toBe("0")
    expect(r.price).toBe("0")
  })

  it("treats a ≥100% target margin as having no finite price (price = cost)", () => {
    const r = computeBid({ ...base, targetMarginPct: "100", areas: [{ name: "A", sqft: 5000, surfaceType: "X", sqftPerHour: 5000, frequency: "MONTHLY" }] })
    expect(r.price).toBe(r.totalCost)
  })

  it("scales monthly hours by cadence (daily > weekly)", () => {
    const weekly = computeBid({ ...base, areas: [{ name: "A", sqft: 5000, surfaceType: "X", sqftPerHour: 5000, frequency: "WEEKLY" }] })
    const daily = computeBid({ ...base, areas: [{ name: "A", sqft: 5000, surfaceType: "X", sqftPerHour: 5000, frequency: "DAILY" }] })
    expect(Number(daily.monthlyHours)).toBeGreaterThan(Number(weekly.monthlyHours))
  })
})
