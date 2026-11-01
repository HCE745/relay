import { describe, it, expect } from "vitest"
import { dec, ZERO } from "../billing-math"
import {
  allocateIndirect,
  proratedAmount,
  poolApplies,
  inclusiveDays,
  type IndirectPool,
  type AllocTarget,
} from "../indirect-costs"

const pool = (over: Partial<IndirectPool> = {}): IndirectPool => ({
  id: "p1",
  name: "Overhead",
  category: "OVERHEAD",
  amount: dec("1000"),
  periodDays: 30,
  basis: "REVENUE",
  effectiveFrom: null,
  effectiveTo: null,
  ...over,
})

const target = (id: string, over: Partial<AllocTarget> = {}): AllocTarget => ({
  id,
  revenue: ZERO,
  laborCost: ZERO,
  laborHours: ZERO,
  jobs: 0,
  ...over,
})

describe("inclusiveDays", () => {
  it("counts a single day as 1", () => {
    expect(inclusiveDays("2026-06-01", "2026-06-01")).toBe(1)
  })
  it("counts a full 30-day span", () => {
    expect(inclusiveDays("2026-06-01", "2026-06-30")).toBe(30)
  })
  it("is 0 when end precedes start", () => {
    expect(inclusiveDays("2026-06-30", "2026-06-01")).toBe(0)
  })
})

describe("proratedAmount", () => {
  it("returns the full amount when report length matches period", () => {
    expect(proratedAmount(pool(), 30).toString()).toBe("1000")
  })
  it("halves for half the period", () => {
    expect(proratedAmount(pool(), 15).toString()).toBe("500")
  })
  it("is zero for a non-positive period or report length", () => {
    expect(proratedAmount(pool({ periodDays: 0 }), 30).isZero()).toBe(true)
    expect(proratedAmount(pool(), 0).isZero()).toBe(true)
  })
})

describe("poolApplies", () => {
  const start = new Date("2026-06-01T00:00:00.000Z")
  const end = new Date("2026-06-30T23:59:59.999Z")
  it("applies with no window", () => {
    expect(poolApplies(pool(), start, end)).toBe(true)
  })
  it("excludes a pool that ends before the period", () => {
    expect(poolApplies(pool({ effectiveTo: new Date("2026-05-01T00:00:00.000Z") }), start, end)).toBe(false)
  })
  it("excludes a pool that starts after the period", () => {
    expect(poolApplies(pool({ effectiveFrom: new Date("2026-07-01T00:00:00.000Z") }), start, end)).toBe(false)
  })
})

describe("allocateIndirect", () => {
  const start = new Date("2026-06-01T00:00:00.000Z")
  const end = new Date("2026-06-30T23:59:59.999Z")

  it("splits by revenue share and re-sums exactly to the pool", () => {
    const targets = [target("a", { revenue: dec("3000") }), target("b", { revenue: dec("1000") })]
    const r = allocateIndirect([pool()], targets, 30, start, end)
    expect(r.byTarget.get("a")!.toString()).toBe("750")
    expect(r.byTarget.get("b")!.toString()).toBe("250")
    expect(r.totalAllocated.toString()).toBe("1000")
    expect(r.unallocated.isZero()).toBe(true)
  })

  it("absorbs rounding drift so the split always re-sums to the pool", () => {
    // 1000 / 3 even split = 333.33 × 3 = 999.99; the remainder (0.01) lands on one row.
    const targets = [target("a", { jobs: 1 }), target("b", { jobs: 1 }), target("c", { jobs: 1 })]
    const r = allocateIndirect([pool({ basis: "JOB_COUNT" })], targets, 30, start, end)
    const sum = [...r.byTarget.values()].reduce((acc, v) => acc.plus(v), ZERO)
    expect(sum.toString()).toBe("1000")
  })

  it("falls back to an even split when the chosen driver sums to zero", () => {
    // Revenue basis but no revenue anywhere → even across the two rows.
    const targets = [target("a"), target("b")]
    const r = allocateIndirect([pool()], targets, 30, start, end)
    expect(r.byTarget.get("a")!.toString()).toBe("500")
    expect(r.byTarget.get("b")!.toString()).toBe("500")
  })

  it("marks the pool unallocated when there are no targets", () => {
    const r = allocateIndirect([pool()], [], 30, start, end)
    expect(r.totalAllocated.isZero()).toBe(true)
    expect(r.unallocated.toString()).toBe("1000")
  })

  it("prorates a shorter report window", () => {
    const targets = [target("a", { revenue: dec("1000") })]
    const r = allocateIndirect([pool()], targets, 15, start, end)
    expect(r.byTarget.get("a")!.toString()).toBe("500")
  })

  it("skips pools outside their effective window", () => {
    const targets = [target("a", { revenue: dec("1000") })]
    const future = pool({ effectiveFrom: new Date("2026-07-01T00:00:00.000Z") })
    const r = allocateIndirect([future], targets, 30, start, end)
    expect(r.totalAllocated.isZero()).toBe(true)
    expect(r.byTarget.size).toBe(0)
  })
})
