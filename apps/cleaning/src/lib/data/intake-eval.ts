// Address/contact evaluation at intake (quote, online booking, customer create).
// Phase 17 ships the seam; Phase 19 (service areas & exclusions) fills in the
// real logic. Returns whether the address is inside a service area and any
// exclusion flags — callers WARN (never hard-block) and surface the reason.

export type IntakeEvaluation = {
  outsideServiceArea: boolean
  // Exclusion matches (Phase 19). Each carries a reason for staff; empty here.
  exclusions: { kind: "address" | "contact" | "zone"; reason: string; note?: string }[]
}

export type IntakeSubject = {
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

/**
 * Evaluate an address/contact against service areas and exclusion lists.
 * Phase 17 default: everything is serviceable and unexcluded (no areas/lists
 * defined yet). Phase 19 replaces the body — callers already handle the flags.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function evaluateIntake(orgId: string, subject: IntakeSubject): Promise<IntakeEvaluation> {
  return { outsideServiceArea: false, exclusions: [] }
}
