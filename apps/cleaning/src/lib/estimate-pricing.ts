import { Prisma } from "../generated/prisma/client"
import { RequirementsError } from "./data/errors"

// Pure estimate math + the estimate→ServicePlan pricing mapping, so the
// conversion rule is unit-testable without a DB. Money is Prisma.Decimal.

type Money = Prisma.Decimal
const round2 = (d: Money): Money => d.toDecimalPlaces(2)
const ZERO = new Prisma.Decimal(0)

/** A single estimate line's amount = quantity × unit rate (2 dp). */
export function lineAmount(quantity: Money, unitRate: Money): Money {
  return round2(quantity.times(unitRate))
}

/** Document total = sum of line amounts. */
export function estimateTotal(lines: { amount: Money }[]): Money {
  return lines.reduce((acc, l) => acc.plus(l.amount), ZERO)
}

/**
 * Map an estimate's pricing SHAPE to a ServicePlan billingType + rate — the rule
 * that lets Phase 2 invoicing work on a converted customer with no re-entry:
 *   PER_VISIT → FLAT_PER_JOB, rate = explicit per-visit rate (else the total)
 *   HOURLY    → HOURLY, rate = the explicit hourly rate (never the total — an
 *               hourly rate cannot be inferred from a visit total)
 * Throws RequirementsError (→ 422) rather than guessing when it cannot map:
 *   - PER_VISIT with no price, or HOURLY with no hourly rate.
 */
export function planPricingFromEstimate(est: {
  pricing: string
  rate: Money | null
  total: Money
}): { billingType: "FLAT_PER_JOB" | "HOURLY"; rate: Money } {
  if (est.pricing === "PER_VISIT") {
    const rate = est.rate ?? est.total
    if (rate.lessThanOrEqualTo(ZERO)) {
      throw new RequirementsError("This per-visit estimate has no price to bill", [
        "Add priced line items, or set a per-visit rate, before converting",
      ])
    }
    return { billingType: "FLAT_PER_JOB", rate: round2(rate) }
  }
  if (est.pricing === "HOURLY") {
    if (est.rate == null || est.rate.lessThanOrEqualTo(ZERO)) {
      throw new RequirementsError("This hourly estimate has no hourly rate", [
        "Set an hourly rate before converting — the visit total can't be assumed to be the hourly rate",
      ])
    }
    return { billingType: "HOURLY", rate: round2(est.rate) }
  }
  throw new RequirementsError("This estimate's pricing can't map to a billing type", [
    `Unknown pricing model: ${est.pricing}`,
  ])
}
