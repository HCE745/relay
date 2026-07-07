import type { PlanKey, ModuleId } from "./pricing"
import { PLANS, PRO_EMPLOYEE_BANDS, PP_EMPLOYEE_BANDS } from "./pricing"

// Map from our internal IDs to Stripe Price IDs (read at call time so env is loaded)
export function getPriceId(key: string): string {
  const map: Record<string, string | undefined> = {
    // Base plans
    essentials:                process.env.STRIPE_PRICE_ESSENTIALS,
    professional:              process.env.STRIPE_PRICE_PROFESSIONAL,
    professional_plus:         process.env.STRIPE_PRICE_PROFESSIONAL_PLUS,
    // Professional additional location
    additional_location:       process.env.STRIPE_PRICE_ADDITIONAL_LOCATION,
    // Professional employee bands
    employees_51_100:          process.env.STRIPE_PRICE_EMPLOYEES_51_100,
    employees_101_200:         process.env.STRIPE_PRICE_EMPLOYEES_101_200,
    employees_201_350:         process.env.STRIPE_PRICE_EMPLOYEES_201_350,
    employees_351_500:         process.env.STRIPE_PRICE_EMPLOYEES_351_500,
    // Professional Plus additional location
    pp_additional_location:    process.env.STRIPE_PRICE_PP_ADDITIONAL_LOCATION,
    // Professional Plus employee bands (above 250 included)
    pp_employees_251_500:      process.env.STRIPE_PRICE_PP_EMPLOYEES_251_500,
    pp_employees_501_1000:     process.env.STRIPE_PRICE_PP_EMPLOYEES_501_1000,
    pp_employees_1001_2500:    process.env.STRIPE_PRICE_PP_EMPLOYEES_1001_2500,
    // Intelligence modules (Professional add-ons; included in Professional Plus)
    issue_intelligence:        process.env.STRIPE_PRICE_ISSUE_INTELLIGENCE,
    sop_intelligence:          process.env.STRIPE_PRICE_SOP_INTELLIGENCE,
    asset_intelligence:        process.env.STRIPE_PRICE_ASSET_INTELLIGENCE,
    benchmark_intelligence:    process.env.STRIPE_PRICE_BENCHMARK_INTELLIGENCE,
    purchase_intelligence:     process.env.STRIPE_PRICE_PURCHASE_INTELLIGENCE,
    intelligence_suite:        process.env.STRIPE_PRICE_INTELLIGENCE_SUITE,
  }
  const id = map[key]
  if (!id) throw new Error(`Missing Stripe price ID for key: ${key}`)
  return id
}

function proEmployeeBandKey(employeeCount: number): string | null {
  const band = PRO_EMPLOYEE_BANDS.find(
    b => employeeCount >= b.min && (b.max === null || employeeCount <= b.max)
  )
  if (!band || band.additionalCost === 0 || !band.priceKey) return null
  return band.priceKey
}

function ppEmployeeBandKey(employeeCount: number): string | null {
  const band = PP_EMPLOYEE_BANDS.find(
    b => employeeCount >= b.min && (b.max === null || employeeCount <= b.max)
  )
  if (!band || band.additionalCost === 0 || !band.priceKey) return null
  return band.priceKey
}

export interface LineItem {
  price:    string
  quantity: number
}

export function buildLineItems({
  plan,
  employeeCount,
  locationCount,
  selectedModuleIds,
  intelligenceSuite,
}: {
  plan:              PlanKey
  employeeCount:     number
  locationCount:     number
  selectedModuleIds: ModuleId[]
  intelligenceSuite: boolean
}): LineItem[] {
  const items: LineItem[] = []

  // Base plan
  items.push({ price: getPriceId(plan), quantity: 1 })

  if (plan === "professional") {
    // Employee band scaling
    const bandKey = proEmployeeBandKey(employeeCount)
    if (bandKey) items.push({ price: getPriceId(bandKey), quantity: 1 })

    // Additional locations (1 included, +$50/each, max 15)
    const extra = Math.max(0, locationCount - PLANS.professional.includedLocations)
    if (extra > 0) items.push({ price: getPriceId("additional_location"), quantity: extra })

    // Intelligence modules (optional add-ons)
    if (intelligenceSuite) {
      items.push({ price: getPriceId("intelligence_suite"), quantity: 1 })
    } else {
      for (const modId of new Set(selectedModuleIds)) {
        items.push({ price: getPriceId(modId), quantity: 1 })
      }
    }
  }

  if (plan === "professional_plus") {
    // Employee band scaling (250 included)
    const bandKey = ppEmployeeBandKey(employeeCount)
    if (bandKey) items.push({ price: getPriceId(bandKey), quantity: 1 })

    // Additional locations (10 included, +$40/each, max 100)
    const extra = Math.max(0, locationCount - PLANS.professional_plus.includedLocations)
    if (extra > 0) items.push({ price: getPriceId("pp_additional_location"), quantity: extra })

    // Intelligence Suite is included in PP base price — no separate line item
  }

  return items
}
