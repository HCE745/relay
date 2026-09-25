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
  entryLaborCost,
  marginPct,
  summarizeMargin,
  countsTowardMargin,
  deriveInvoiceStatus,
  remainingBalance,
  overpays,
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

describe("entryLaborCost — salaried labor is excluded, never invented", () => {
  const at = (iso: string) => new Date(iso)
  const entry = (mins: number, brk = 0) => ({
    clockInAt: at("2026-09-16T09:00:00Z"),
    clockOutAt: new Date(at("2026-09-16T09:00:00Z").getTime() + mins * 60000),
    breakMinutes: brk,
  })
  it("HOURLY: worked hours × rate, net of breaks", () => {
    expect(entryLaborCost(entry(90), dec("30"), "HOURLY")?.toFixed(2)).toBe("45.00") // 1.5h × 30
    expect(entryLaborCost(entry(120, 30), dec("30"), "HOURLY")?.toFixed(2)).toBe("45.00")
  })
  it("SALARY: unavailable (null) — no ÷2080, no invented number", () => {
    expect(entryLaborCost(entry(60), dec("52000"), "SALARY")).toBeNull()
    expect(entryLaborCost(entry(60), dec("30"), "SALARY")).toBeNull()
  })
  it("missing rate: unavailable (null)", () => {
    expect(entryLaborCost(entry(90), null, "HOURLY")).toBeNull()
  })
  it("open entry (no clock-out), HOURLY → 0", () => {
    expect(entryLaborCost({ clockInAt: at("2026-09-16T09:00:00Z"), clockOutAt: null, breakMinutes: 0 }, dec("30"), "HOURLY")?.toFixed(2)).toBe("0.00")
  })
})

describe("summarizeMargin — uninvoiced excluded by default; salaried excluded always", () => {
  const billed = { invoiced: true, laborKnown: true, billed: dec("200"), labor: dec("45") }
  const uninvoiced = { invoiced: false, laborKnown: true, billed: dec("0"), labor: dec("60") }
  const salaried = { invoiced: true, laborKnown: false, billed: dec("300"), labor: dec("0") }

  it("default view excludes uninvoiced work — no false loss", () => {
    const s = summarizeMargin([billed, uninvoiced, salaried], false)
    expect(s.revenue.toFixed(2)).toBe("200.00") // only the invoiced+known job
    expect(s.laborCost.toFixed(2)).toBe("45.00")
    expect(s.margin.toFixed(2)).toBe("155.00")
    expect(s.marginPct).toBe(77.5)
    expect(s.jobs).toBe(1)
    expect(s.uninvoicedJobs).toBe(1)
    expect(s.uninvoicedLabor.toFixed(2)).toBe("60.00") // surfaced separately, not in margin
    expect(s.unavailableJobs).toBe(1) // salaried job excluded
  })

  it("include-uninvoiced folds unbilled work in (opt-in), still excludes salaried", () => {
    const s = summarizeMargin([billed, uninvoiced, salaried], true)
    expect(s.revenue.toFixed(2)).toBe("200.00") // uninvoiced adds $0 revenue
    expect(s.laborCost.toFixed(2)).toBe("105.00") // 45 + 60
    expect(s.margin.toFixed(2)).toBe("95.00")
    expect(s.jobs).toBe(2)
    expect(s.unavailableJobs).toBe(1) // salaried never counted, even when including uninvoiced
  })

  it("only invoiced known-labor jobs count by default", () => {
    expect(countsTowardMargin({ invoiced: true, laborKnown: true }, false)).toBe(true)
    expect(countsTowardMargin({ invoiced: false, laborKnown: true }, false)).toBe(false)
    expect(countsTowardMargin({ invoiced: false, laborKnown: true }, true)).toBe(true)
    expect(countsTowardMargin({ invoiced: true, laborKnown: false }, true)).toBe(false) // salaried never
  })
})

describe("deriveInvoiceStatus — status follows the payments, never set by hand", () => {
  const d = (v: string) => dec(v)
  it("DRAFT and VOID pass through unchanged", () => {
    expect(deriveInvoiceStatus("DRAFT", d("100"), d("0"))).toBe("DRAFT")
    expect(deriveInvoiceStatus("VOID", d("100"), d("50"))).toBe("VOID")
  })
  it("issued: none paid → SENT, some → PARTIALLY_PAID, full → PAID", () => {
    expect(deriveInvoiceStatus("SENT", d("100"), d("0"))).toBe("SENT")
    expect(deriveInvoiceStatus("SENT", d("100"), d("40"))).toBe("PARTIALLY_PAID")
    expect(deriveInvoiceStatus("PARTIALLY_PAID", d("100"), d("100"))).toBe("PAID")
    expect(deriveInvoiceStatus("SENT", d("100"), d("100"))).toBe("PAID")
  })
})

describe("overpayment guard — never a negative balance", () => {
  const d = (v: string) => dec(v)
  it("remainingBalance never goes below 0", () => {
    expect(remainingBalance(d("100"), d("40")).toFixed(2)).toBe("60.00")
    expect(remainingBalance(d("100"), d("120")).toFixed(2)).toBe("0.00")
  })
  it("overpays flags a payment beyond the balance; exact payment is allowed", () => {
    expect(overpays(d("100"), d("40"), d("60"))).toBe(false) // exactly to zero
    expect(overpays(d("100"), d("40"), d("60.01"))).toBe(true) // one cent over
    expect(overpays(d("100"), d("0"), d("100"))).toBe(false)
    expect(overpays(d("100"), d("0"), d("100.01"))).toBe(true)
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
