import { describe, it, expect } from "vitest"
import {
  dec,
  round2,
  billableMinutes,
  hoursFromMinutes,
  flatLine,
  hourlyLine,
  dueDateFromTerms,
  agingBucket,
  startOfUtcDay,
  endOfUtcDay,
} from "../billing-math"

describe("round2", () => {
  it("rounds half up to 2 dp", () => {
    expect(round2(dec("1.005")).toFixed(2)).toBe("1.01")
    expect(round2(dec("1.004")).toFixed(2)).toBe("1.00")
    expect(round2(dec("2.675")).toFixed(2)).toBe("2.68")
  })
})

describe("billableMinutes", () => {
  const at = (iso: string) => new Date(iso)
  it("returns 0 when not clocked out", () => {
    expect(billableMinutes({ clockInAt: at("2026-09-16T09:00:00Z"), clockOutAt: null, breakMinutes: 0 })).toBe(0)
  })
  it("counts worked minutes net of breaks", () => {
    expect(
      billableMinutes({ clockInAt: at("2026-09-16T09:00:00Z"), clockOutAt: at("2026-09-16T11:00:00Z"), breakMinutes: 15 }),
    ).toBe(105)
  })
  it("never goes negative when breaks exceed the gap", () => {
    expect(
      billableMinutes({ clockInAt: at("2026-09-16T09:00:00Z"), clockOutAt: at("2026-09-16T09:10:00Z"), breakMinutes: 30 }),
    ).toBe(0)
  })
})

describe("hoursFromMinutes", () => {
  it("converts to 2-dp hours", () => {
    expect(hoursFromMinutes(90).toFixed(2)).toBe("1.50")
    expect(hoursFromMinutes(50).toFixed(2)).toBe("0.83") // 0.8333… → 0.83
    expect(hoursFromMinutes(0).toFixed(2)).toBe("0.00")
  })
})

describe("flatLine", () => {
  it("bills one unit at the plan rate", () => {
    const { quantity, amount } = flatLine(dec("120.50"))
    expect(quantity.toString()).toBe("1")
    expect(amount.toFixed(2)).toBe("120.50")
  })
})

describe("hourlyLine", () => {
  it("bills approved hours × rate, rounded at the line", () => {
    const { quantity, amount } = hourlyLine(90, dec("100"))
    expect(quantity.toFixed(2)).toBe("1.50")
    expect(amount.toFixed(2)).toBe("150.00")
  })
  it("rounds the amount to 2 dp", () => {
    const { quantity, amount } = hourlyLine(50, dec("90")) // 0.83h × 90
    expect(quantity.toFixed(2)).toBe("0.83")
    expect(amount.toFixed(2)).toBe("74.70")
  })
})

describe("dueDateFromTerms", () => {
  const from = new Date("2026-09-16T00:00:00Z")
  it("DUE_ON_RECEIPT is same day", () => {
    expect(dueDateFromTerms(from, "DUE_ON_RECEIPT").toISOString()).toBe("2026-09-16T00:00:00.000Z")
  })
  it("NET_15 / NET_30 add days", () => {
    expect(dueDateFromTerms(from, "NET_15").toISOString()).toBe("2026-10-01T00:00:00.000Z")
    expect(dueDateFromTerms(from, "NET_30").toISOString()).toBe("2026-10-16T00:00:00.000Z")
  })
})

describe("agingBucket", () => {
  it("buckets by days overdue at the right boundaries", () => {
    expect(agingBucket(-5)).toBe("current")
    expect(agingBucket(0)).toBe("current")
    expect(agingBucket(1)).toBe("d1_30")
    expect(agingBucket(30)).toBe("d1_30")
    expect(agingBucket(31)).toBe("d31_60")
    expect(agingBucket(60)).toBe("d31_60")
    expect(agingBucket(61)).toBe("d61_90")
    expect(agingBucket(90)).toBe("d61_90")
    expect(agingBucket(91)).toBe("d90")
  })
})

describe("utc day bounds", () => {
  it("brackets a calendar day", () => {
    expect(startOfUtcDay("2026-09-16").toISOString()).toBe("2026-09-16T00:00:00.000Z")
    expect(endOfUtcDay("2026-09-16").toISOString()).toBe("2026-09-16T23:59:59.999Z")
  })
})
