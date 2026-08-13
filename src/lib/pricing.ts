// Relay subscription pricing — all amounts in USD/month.

export const PLANS = {
  essentials: {
    label:                   "Relay Essentials",
    basePrice:               149,
    includedLocations:       1,
    maxLocations:            1,
    includedEmployees:       25,
    maxEmployees:            25,
    additionalLocationPrice: 0,
  },
  professional: {
    label:                   "Relay Professional",
    basePrice:               299,
    includedLocations:       1,
    maxLocations:            15,
    includedEmployees:       50,
    maxEmployees:            500,
    additionalLocationPrice: 50,
  },
  professional_plus: {
    label:                   "Relay Professional Plus",
    basePrice:               999,
    includedLocations:       10,
    maxLocations:            100,
    includedEmployees:       250,
    maxEmployees:            2500,
    additionalLocationPrice: 40,
  },
} as const

export type PlanKey = keyof typeof PLANS

// ─── Employee bands ───────────────────────────────────────────────────────────

export interface EmployeeBand {
  label:          string
  min:            number
  max:            number | null
  additionalCost: number
  priceKey:       string | null
  contactSales:   boolean
}

// Professional plan employee bands (max 500 employees)
export const PRO_EMPLOYEE_BANDS: EmployeeBand[] = [
  { label: "1–50",    min:   1, max:   50, additionalCost:   0, priceKey: null,                   contactSales: false },
  { label: "51–100",  min:  51, max:  100, additionalCost:  50, priceKey: "employees_51_100",      contactSales: false },
  { label: "101–200", min: 101, max:  200, additionalCost: 100, priceKey: "employees_101_200",     contactSales: false },
  { label: "201–350", min: 201, max:  350, additionalCost: 150, priceKey: "employees_201_350",     contactSales: false },
  { label: "351–500", min: 351, max:  500, additionalCost: 200, priceKey: "employees_351_500",     contactSales: false },
]

// Professional Plus employee bands (250 included, bands cover above that)
export const PP_EMPLOYEE_BANDS: EmployeeBand[] = [
  { label: "1–250",     min:    1, max:  250, additionalCost:   0, priceKey: null,                      contactSales: false },
  { label: "251–500",   min:  251, max:  500, additionalCost: 100, priceKey: "pp_employees_251_500",    contactSales: false },
  { label: "501–1000",  min:  501, max: 1000, additionalCost: 200, priceKey: "pp_employees_501_1000",   contactSales: false },
  { label: "1001–2500", min: 1001, max: 2500, additionalCost: 400, priceKey: "pp_employees_1001_2500",  contactSales: false },
]

// Legacy alias — defaults to Professional bands for any code that hasn't been migrated
export const EMPLOYEE_BANDS = PRO_EMPLOYEE_BANDS

export function getEmployeeBand(employeeCount: number, plan: PlanKey = "professional"): EmployeeBand {
  const bands = plan === "professional_plus" ? PP_EMPLOYEE_BANDS : PRO_EMPLOYEE_BANDS
  return (
    bands.find(b => employeeCount >= b.min && (b.max === null || employeeCount <= b.max)) ??
    bands[bands.length - 1]
  )
}

// ─── Intelligence Modules ────────────────────────────────────────────────────

export const INTELLIGENCE_MODULES = [
  { id: "issue_intelligence",     label: "Issue Intelligence",     price: 49 },
  { id: "sop_intelligence",       label: "SOP Intelligence",       price: 49 },
  { id: "asset_intelligence",     label: "Asset Intelligence",     price: 49 },
  { id: "benchmark_intelligence", label: "Benchmark Intelligence", price: 49 },
  { id: "purchase_intelligence",  label: "Purchase Intelligence",  price: 49 },
] as const

export type ModuleId = typeof INTELLIGENCE_MODULES[number]["id"]

export const INTELLIGENCE_SUITE_PRICE = 199

// ─── Price calculation ────────────────────────────────────────────────────────

export interface PricingInput {
  plan:              PlanKey
  employeeCount:     number
  locationCount:     number
  selectedModuleIds: ModuleId[]
  intelligenceSuite: boolean
  discountPercent?:  number
}

export interface PricingResult {
  basePrice:           number
  locationScaling:     number
  employeeScaling:     number
  moduleCost:          number
  totalBeforeDiscount: number
  discountAmount:      number
  totalAfterDiscount:  number
  contactSales:        boolean
  employeeBandLabel:   string
}

export function calculatePrice(input: PricingInput): PricingResult {
  const planCfg = PLANS[input.plan]
  const band    = getEmployeeBand(input.employeeCount, input.plan)

  const basePrice       = planCfg.basePrice
  const employeeScaling = band.additionalCost

  const extraLocations  = Math.max(0, input.locationCount - planCfg.includedLocations)
  const locationScaling =
    input.plan === "professional" || input.plan === "professional_plus"
      ? extraLocations * planCfg.additionalLocationPrice
      : 0

  // Module cost: included in Professional Plus base; optional add-on for Professional only
  let moduleCost = 0
  if (input.plan === "professional") {
    if (input.intelligenceSuite) {
      moduleCost = INTELLIGENCE_SUITE_PRICE
    } else {
      const unique = new Set(input.selectedModuleIds)
      for (const mod of INTELLIGENCE_MODULES) {
        if (unique.has(mod.id)) moduleCost += mod.price
      }
    }
  }
  // Professional Plus: intelligence suite is included in base price — no additional charge

  const totalBeforeDiscount = basePrice + employeeScaling + locationScaling + moduleCost
  const discountAmount      = input.discountPercent
    ? Math.round(totalBeforeDiscount * (input.discountPercent / 100))
    : 0
  const totalAfterDiscount  = totalBeforeDiscount - discountAmount

  return {
    basePrice,
    locationScaling,
    employeeScaling,
    moduleCost,
    totalBeforeDiscount,
    discountAmount,
    totalAfterDiscount,
    contactSales:     false,
    employeeBandLabel: band.label,
  }
}

// ─── Feature gating ───────────────────────────────────────────────────────────

// Plans that grant full platform access (no Essentials gating)
export const FULL_ACCESS_PLANS = new Set([
  "professional", "professional_plus", "enterprise",
  // Legacy plan names kept for backwards compatibility:
  "custom", "pro", "starter",
])

export interface OrgFeatureFlags {
  regions_enabled:                  boolean
  corporate_dashboard_enabled:      boolean
  cross_location_analytics_enabled: boolean
  advanced_escalations_enabled:     boolean
  api_webhooks_enabled:             boolean
  sso_foundation_enabled:           boolean
  shared_facility_enabled:          boolean
  qr_codes_enabled:                 boolean
  external_collaborators_enabled:   boolean
  multi_org_enabled:                boolean
  executive_briefings_enabled:      boolean
  health_scores_enabled:            boolean
  trend_detection_enabled:          boolean
  executive_goals_enabled:          boolean
}

export const FEATURE_FLAG_LABELS: Record<keyof OrgFeatureFlags, string> = {
  regions_enabled:                  "Regions",
  corporate_dashboard_enabled:      "Corporate & Regional Dashboards",
  cross_location_analytics_enabled: "Cross-Location Analytics",
  advanced_escalations_enabled:     "Advanced Escalation Trees",
  api_webhooks_enabled:             "API & Webhooks",
  sso_foundation_enabled:           "SSO Configuration",
  shared_facility_enabled:          "Shared Facility / Org Linking",
  qr_codes_enabled:                 "Smart QR Reporting",
  external_collaborators_enabled:   "External Collaborators",
  multi_org_enabled:                "Multi-Organization Switching",
  executive_briefings_enabled:      "Executive AI Briefings",
  health_scores_enabled:            "AI Operational Health Scores",
  trend_detection_enabled:          "AI Trend Detection",
  executive_goals_enabled:          "Executive Goals & KPI Tracking",
}

export const FEATURE_FLAG_DESCRIPTIONS: Record<keyof OrgFeatureFlags, string> = {
  regions_enabled:                  "Add a Region layer above Locations. Group locations into regions for hierarchical reporting.",
  corporate_dashboard_enabled:      "Company-wide and region-scoped dashboards with cross-location issue metrics.",
  cross_location_analytics_enabled: "Compare issue volume, resolution time, and escalation rate across locations and regions.",
  advanced_escalations_enabled:     "Multi-step escalation chains with rules based on priority, category, location, and time.",
  api_webhooks_enabled:             "Generate API keys and register webhook endpoints for real-time event notifications.",
  sso_foundation_enabled:           "Configure SSO identity provider settings (Google Workspace, Entra, Okta, SAML).",
  shared_facility_enabled:          "Link multiple organizations operating in the same facility for cross-org issue routing.",
  qr_codes_enabled:                 "Generate QR codes for locations, areas, and assets that open pre-filled reporting forms.",
  external_collaborators_enabled:   "Invite external contractors and vendors with restricted access to their assigned issues only.",
  multi_org_enabled:                "Allow users to belong to multiple organizations and switch between them without re-logging in.",
  executive_briefings_enabled:      "AI-powered daily, weekly, and monthly operational briefings generated from your issue data.",
  health_scores_enabled:            "AI-calculated operational health scores (0–100) for your org, regions, and locations.",
  trend_detection_enabled:          "Automated background trend detection: volume spikes, recurring assets, safety increases, slow resolution.",
  executive_goals_enabled:          "Set operational goals with measurable targets and track progress automatically against real data.",
}

export function isProfessional(plan: string) {
  return FULL_ACCESS_PLANS.has(plan)
}

// ─── Wash Essentials gating ───────────────────────────────────────────────────

export function isWashEssentials(productLine: string | undefined | null): boolean {
  return productLine === "WASH_ESSENTIALS"
}

// True when the org has access to features unlocked for both Professional and Wash Essentials
// (QR codes, assets, vendors, basic analytics)
export function hasWashOrProfessional(plan: string, productLine: string | undefined | null): boolean {
  return isProfessional(plan) || isWashEssentials(productLine)
}

// Features blocked on Wash Essentials to prevent repurposing as general-purpose Relay.
// Car-wash operational needs (assets, issues, maintenance, QR, vendors) are NOT blocked.
export type WashEssentialsBlock =
  | "arbitrary_departments"   // no generic department structure
  | "workflow_builder"        // no generic automation builder
  | "form_builder"            // no generic form builder
  | "advanced_escalations"    // no custom escalation routing
  | "api_webhooks"            // no external API/webhook access
  | "regions"                 // no multi-region hierarchy
  | "corporate_dashboard"     // no cross-org rollup dashboards
  | "sops"                    // no custom SOP library
  | "purchase_requests"       // out of scope for car-wash Essentials
  | "approval_intelligence"   // advanced config capability
  | "executive_briefings"     // out of scope for car-wash Essentials
  | "custom_role_builder"     // no arbitrary permission set creation

export function isBlockedOnWashEssentials(
  feature: WashEssentialsBlock,
  productLine: string | undefined | null,
): boolean {
  return isWashEssentials(productLine)
}

export function isProfessionalPlus(plan: string) {
  return plan === "professional_plus" || plan === "enterprise"
}

export function isReadOnly(subscriptionStatus: string) {
  return subscriptionStatus === "expired" || subscriptionStatus === "read_only"
}

export function isActive(subscriptionStatus: string) {
  return subscriptionStatus === "active"
}

export function isTrial(subscriptionStatus: string) {
  return subscriptionStatus === "trialing"
}
