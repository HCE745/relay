import { Prisma } from "../generated/prisma/client"
import { VISITS_PER_MONTH } from "./bid-constants"

// Pure bid-calculator math. Commercial cleaning is priced from production rates
// (sq ft per hour) → labor hours → loaded labor cost, plus supplies % and
// overhead %, divided up to a target margin. Money is Prisma.Decimal; kept
// DB-free so every number the owner sees is reproducible and unit-testable.

type Money = Prisma.Decimal
const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v)
const ZERO = D(0)
const r2 = (d: Money) => d.toDecimalPlaces(2)

export { VISITS_PER_MONTH }

export type BidArea = {
  name: string
  sqft: number
  surfaceType: string
  sqftPerHour: number // from the production-rate library (snapshotted into the bid)
  frequency: string
}

export type BidInputs = {
  areas: BidArea[]
  laborRate: string | number // loaded $/hour
  suppliesPct: string | number // % of labor
  overheadPct: string | number // % of (labor + supplies)
  targetMarginPct: string | number // % of price
}

export type BidAreaResult = {
  name: string
  sqft: number
  surfaceType: string
  sqftPerHour: number
  frequency: string
  visitsPerMonth: number
  hoursPerVisit: string
  monthlyHours: string
}

export type BidResult = {
  areas: BidAreaResult[]
  monthlyHours: string
  laborCost: string
  suppliesCost: string
  overheadCost: string
  totalCost: string
  price: string
  margin: string
  marginPct: string
}

/**
 * Compute a monthly bid. hoursPerVisit = sqft / sqftPerHour; monthlyHours scales
 * by visits/month. laborCost = Σ monthlyHours × laborRate. suppliesCost =
 * laborCost × suppliesPct. overheadCost = (labor + supplies) × overheadPct.
 * price = totalCost / (1 − targetMargin). Guards divide-by-zero and a ≥100%
 * margin (which has no finite price).
 */
export function computeBid(inputs: BidInputs): BidResult {
  const laborRate = D(inputs.laborRate || 0)
  const suppliesPct = D(inputs.suppliesPct || 0).div(100)
  const overheadPct = D(inputs.overheadPct || 0).div(100)
  const marginFrac = D(inputs.targetMarginPct || 0).div(100)

  let monthlyHours = ZERO
  const areas: BidAreaResult[] = inputs.areas.map((a) => {
    const rate = D(a.sqftPerHour || 0)
    const sqft = D(a.sqft || 0)
    const vpm = VISITS_PER_MONTH[a.frequency] ?? 1
    const hoursPerVisit = rate.greaterThan(0) ? sqft.div(rate) : ZERO
    const areaMonthly = hoursPerVisit.times(vpm)
    monthlyHours = monthlyHours.plus(areaMonthly)
    return {
      name: a.name,
      sqft: a.sqft,
      surfaceType: a.surfaceType,
      sqftPerHour: a.sqftPerHour,
      frequency: a.frequency,
      visitsPerMonth: vpm,
      hoursPerVisit: hoursPerVisit.toDecimalPlaces(3).toString(),
      monthlyHours: areaMonthly.toDecimalPlaces(3).toString(),
    }
  })

  const laborCost = r2(monthlyHours.times(laborRate))
  const suppliesCost = r2(laborCost.times(suppliesPct))
  const overheadCost = r2(laborCost.plus(suppliesCost).times(overheadPct))
  const totalCost = r2(laborCost.plus(suppliesCost).plus(overheadCost))

  // price = cost / (1 - margin); a margin ≥ 100% is invalid → price = cost.
  const denom = D(1).minus(marginFrac)
  const price = denom.greaterThan(0) ? r2(totalCost.div(denom)) : totalCost
  const margin = r2(price.minus(totalCost))
  const marginPct = price.greaterThan(0) ? margin.div(price).times(100).toDecimalPlaces(1).toString() : "0"

  return {
    areas,
    monthlyHours: monthlyHours.toDecimalPlaces(3).toString(),
    laborCost: laborCost.toString(),
    suppliesCost: suppliesCost.toString(),
    overheadCost: overheadCost.toString(),
    totalCost: totalCost.toString(),
    price: price.toString(),
    margin: margin.toString(),
    marginPct,
  }
}

export { DEFAULT_PRODUCTION_RATES } from "./bid-constants"
