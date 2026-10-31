import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import { dec, type Money } from "../billing-math"
import type { TaxRateCreateInput } from "../zod-schemas"

// Sales-tax configuration (Phase 40). The customer owns every decision here: we
// provide the mechanism and never presume janitorial is taxable in any
// jurisdiction. Rates entered as a percent ("7.25") are stored as a fraction
// (0.0725); invoice generation snapshots the fraction onto each line.

const HUNDRED = new Prisma.Decimal(100)

/** Percent string ("7.25") → fraction Decimal (0.0725). */
export function pctToFraction(pct: string): Money {
  return dec(pct).div(HUNDRED)
}
/** Fraction Decimal (0.0725) → percent number (7.25) for display. */
export function fractionToPct(fraction: Money): number {
  return Number(fraction.times(HUNDRED))
}

export async function listTaxRates(orgId: string) {
  const rates = await orgDb(orgId).taxRate.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] })
  return rates.map((r) => ({ ...r, ratePct: fractionToPct(r.rate) }))
}

/** Active rates only — for the taxability pickers. */
export async function listActiveTaxRates(orgId: string) {
  return (await listTaxRates(orgId)).filter((r) => r.isActive)
}

export async function createTaxRate(orgId: string, input: TaxRateCreateInput) {
  return orgDb(orgId).taxRate.create({
    data: {
      organizationId: orgId,
      name: input.name,
      jurisdiction: input.jurisdiction ?? null,
      rate: pctToFraction(input.ratePct),
      effectiveDate: input.effectiveDate ?? new Date(),
    },
  })
}

export async function updateTaxRate(
  orgId: string,
  id: string,
  input: Partial<TaxRateCreateInput> & { isActive?: boolean },
) {
  const data: Prisma.TaxRateUpdateManyMutationInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.jurisdiction !== undefined) data.jurisdiction = input.jurisdiction ?? null
  if (input.ratePct !== undefined) data.rate = pctToFraction(input.ratePct)
  if (input.effectiveDate !== undefined) data.effectiveDate = input.effectiveDate
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).taxRate.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Tax rate")
  return orgDb(orgId).taxRate.findFirst({ where: { id } })
}

/** Set a site's taxability and the jurisdiction rate that applies there. */
export async function setSiteTaxability(
  orgId: string,
  serviceLocationId: string,
  input: { taxable: boolean; taxRateId?: string | null },
) {
  // A rate id, when given, must belong to this org (org-scoped read enforces it).
  if (input.taxRateId) {
    const rate = await orgDb(orgId).taxRate.findFirst({ where: { id: input.taxRateId }, select: { id: true } })
    assertFound(rate, "Tax rate")
  }
  const res = await orgDb(orgId).serviceLocation.updateMany({
    where: { id: serviceLocationId },
    data: { taxable: input.taxable, taxRateId: input.taxRateId ?? null },
  })
  assertFound(res.count > 0 ? {} : null, "Service location")
  return { ok: true }
}

/** Per-plan override: taxable null = inherit the site; rate null = inherit the site rate. */
export async function setPlanTaxability(
  orgId: string,
  servicePlanId: string,
  input: { taxable?: boolean | null; taxRateId?: string | null },
) {
  if (input.taxRateId) {
    const rate = await orgDb(orgId).taxRate.findFirst({ where: { id: input.taxRateId }, select: { id: true } })
    assertFound(rate, "Tax rate")
  }
  const data: Prisma.ServicePlanUncheckedUpdateManyInput = {}
  if (input.taxable !== undefined) data.taxable = input.taxable
  if (input.taxRateId !== undefined) data.taxRateId = input.taxRateId ?? null
  const res = await orgDb(orgId).servicePlan.updateMany({ where: { id: servicePlanId }, data })
  assertFound(res.count > 0 ? {} : null, "Service plan")
  return { ok: true }
}

/** Sites with their taxability config, for the tax settings screen. */
export async function listSiteTaxability(orgId: string) {
  const sites = await orgDb(orgId).serviceLocation.findMany({
    where: { isActive: true },
    orderBy: [{ customer: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      taxable: true,
      taxRateId: true,
      customer: { select: { name: true } },
      taxRate: { select: { name: true, rate: true } },
    },
  })
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    customerName: s.customer.name,
    taxable: s.taxable,
    taxRateId: s.taxRateId,
    taxRateName: s.taxRate?.name ?? null,
    taxRatePct: s.taxRate ? fractionToPct(s.taxRate.rate) : null,
  }))
}
