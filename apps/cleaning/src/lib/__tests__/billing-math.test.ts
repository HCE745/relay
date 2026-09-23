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
  isInBillingPeriod,
  effectiveHourlyRate,
  laborCostForEntry,
  marginPct,
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

describe("effectiveHourlyRate", () => {
  it("passes HOURLY through and converts SALARY at 2080 hrs/yr", () => {
    expect(effectiveHourlyRate(dec("30"), "HOURLY").toFixed(2)).toBe("30.00")
    expect(effectiveHourlyRate(dec("52000"), "SALARY").toFixed(2)).toBe("25.00") // 52000/2080
    expect(effectiveHourlyRate(dec("30"), null).toFixed(2)).toBe("30.00") // null type treated as hourly
  })
})

describe("laborCostForEntry", () => {
  const at = (iso: string) => new Date(iso)
  const entry = (mins: number, brk = 0) => ({
    clockInAt: at("2026-09-16T09:00:00Z"),
    clockOutAt: new Date(at("2026-09-16T09:00:00Z").getTime() + mins * 60000),
    breakMinutes: brk,
  })
  it("HOURLY: worked hours × rate, net of breaks", () => {
    expect(laborCostForEntry(entry(90), dec("30"), "HOURLY").toFixed(2)).toBe("45.00") // 1.5h × 30
    expect(laborCostForEntry(entry(120, 30), dec("30"), "HOURLY").toFixed(2)).toBe("45.00") // 1.5h × 30
  })
  it("SALARY: hours × (rate / 2080)", () => {
    expect(laborCostForEntry(entry(60), dec("52000"), "SALARY").toFixed(2)).toBe("25.00")
  })
  it("null rate → 0 (never guessed)", () => {
    expect(laborCostForEntry(entry(90), null, "HOURLY").toFixed(2)).toBe("0.00")
  })
  it("open entry (no clock-out) → 0", () => {
    expect(laborCostForEntry({ clockInAt: at("2026-09-16T09:00:00Z"), clockOutAt: null, breakMinutes: 0 }, dec("30"), "HOURLY").toFixed(2)).toBe("0.00")
  })
})

describe("marginPct", () => {
  it("computes (revenue-cost)/revenue as a 1-dp percent", () => {
    expect(marginPct(dec("100"), dec("60"))).toBe(40)
    expect(marginPct(dec("100"), dec("100"))).toBe(0)
    expect(marginPct(dec("100"), dec("130"))).toBe(-30)
  })
  it("returns null when there is no revenue (avoids divide-by-zero)", () => {
    expect(marginPct(dec("0"), dec("50"))).toBeNull()
  })
})

describe("isInBillingPeriod — month boundary in a non-UTC site timezone", () => {
  it("negative offset: 8pm on the 31st local stays in that month (though it is the 1st in UTC)", () => {
    // 2026-08-31 20:00 America/New_York (EDT, UTC-4) === 2026-09-01T00:00:00Z.
    const instant = new Date("2026-09-01T00:00:00.000Z")
    const tz = "America/New_York"
    expect(isInBillingPeriod(instant, tz, "2026-08-01", "2026-08-31")).toBe(true) // belongs to August
    expect(isInBillingPeriod(instant, tz, "2026-09-01", "2026-09-30")).toBe(false) // NOT September
    // A naive UTC bound would have (wrongly) placed it in September:
    expect(instant >= startOfUtcDay("2026-09-01")).toBe(true)
  })

  it("positive offset: 8am on the 1st local belongs to the new month (though it is the 31st in UTC)", () => {
    // 2026-09-01 08:00 Asia/Tokyo (UTC+9) === 2026-08-31T23:00:00Z.
    const instant = new Date("2026-08-31T23:00:00.000Z")
    const tz = "Asia/Tokyo"
    expect(isInBillingPeriod(instant, tz, "2026-09-01", "2026-09-30")).toBe(true) // belongs to September
    expect(isInBillingPeriod(instant, tz, "2026-08-01", "2026-08-31")).toBe(false) // NOT August
    // A naive UTC bound would have (wrongly) placed it in August:
    expect(instant <= endOfUtcDay("2026-08-31")).toBe(true)
  })

  it("a mid-period job is included; a clearly-outside job is not", () => {
    const mid = new Date("2026-09-15T14:00:00.000Z")
    expect(isInBillingPeriod(mid, "America/New_York", "2026-09-01", "2026-09-30")).toBe(true)
    expect(isInBillingPeriod(mid, "America/New_York", "2026-10-01", "2026-10-31")).toBe(false)
  })
})
