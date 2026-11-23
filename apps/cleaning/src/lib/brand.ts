// ─── Product brand ───────────────────────────────────────────────────────────
// Single source of truth for the customer-facing product name. To rebrand the
// whole app, change `name` here (and drop a logo at /public/brand/logo.svg, then
// flip `hasLogo` — see components/brand/wordmark.tsx).
//
// `legalName` is the operating company and is kept for legal / registration copy
// where the entity (not the product) is what's meant. Prefer BRAND.name in all
// ordinary UI, email and document copy.
export const BRAND = {
  name: "CleanWare",
  legalName: "HCE Cleaning",
  tagline: "Cleaning operations, under control.",
  // Short label used where a single glyph is shown (sidebar mark, favicons).
  initial: "C",
} as const

/** Default email "From" display name + address (overridable via env). */
export function brandEmailFrom(address = "onboarding@resend.dev"): string {
  return `${BRAND.name} <${address}>`
}
