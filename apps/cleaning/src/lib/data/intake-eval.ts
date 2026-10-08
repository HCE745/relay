// Address/contact evaluation at intake (quote, online booking, customer create).
// Phase 19: matches against active service areas and the do-not-serve exclusion
// lists. Callers WARN (never hard-block) and surface the reason to staff; the
// public booking path treats out-of-area neutrally and never reveals exclusions.

import { orgDb } from "../org-db"

export type IntakeExclusion = { kind: "address" | "contact" | "zone"; reason: string; note?: string }

export type IntakeEvaluation = {
  outsideServiceArea: boolean
  exclusions: IntakeExclusion[]
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

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase()
const normPhone = (s?: string | null) => (s ?? "").replace(/\D/g, "")
const normZip = (s?: string | null) => (s ?? "").trim()

/**
 * Evaluate an address/contact against service areas and exclusion lists.
 *
 * Service area: with no active areas defined, everything is serviceable. With
 * ZIP-based areas defined and a postal code supplied that matches none, the
 * address is flagged outside (never silently refused). Radius-only areas can't
 * be evaluated without geocoding (no geocoder wired), so they never flag an
 * address outside — ZIP matching is the active path.
 */
export async function evaluateIntake(orgId: string, subject: IntakeSubject): Promise<IntakeEvaluation> {
  const db = orgDb(orgId)
  const [areas, exAddresses, exContacts, exZones] = await Promise.all([
    db.serviceArea.findMany({ where: { active: true }, select: { zipCodes: true, radiusMiles: true } }),
    db.excludedAddress.findMany({ select: { addressLine1: true, postalCode: true, reason: true, note: true } }),
    db.excludedContact.findMany({ select: { name: true, phone: true, email: true, reason: true, note: true } }),
    db.excludedZone.findMany({ select: { value: true, reason: true, note: true } }),
  ])

  // ── Service area ──
  let outsideServiceArea = false
  if (areas.length > 0) {
    const zip = normZip(subject.postalCode)
    const zipAreas = areas.filter((a) => a.zipCodes.length > 0)
    const hasRadiusArea = areas.some((a) => a.radiusMiles != null)
    const matchedZip = !!zip && zipAreas.some((a) => a.zipCodes.map(normZip).includes(zip))
    // Flag outside only when we can actually evaluate it: a postal code is
    // supplied, ZIP areas exist, none match, and no radius area could still cover it.
    if (!matchedZip && !!zip && zipAreas.length > 0 && !hasRadiusArea) outsideServiceArea = true
  }

  // ── Exclusions (do-not-serve) ──
  const exclusions: IntakeExclusion[] = []
  const subAddr = norm(subject.addressLine1)
  const subZip = normZip(subject.postalCode)
  const subCity = norm(subject.city)
  const subPhone = normPhone(subject.contactPhone)
  const subEmail = norm(subject.contactEmail)
  const subName = norm(subject.contactName)

  for (const e of exAddresses) {
    if (subAddr && norm(e.addressLine1) === subAddr && (!e.postalCode || !subZip || normZip(e.postalCode) === subZip)) {
      exclusions.push({ kind: "address", reason: e.reason, note: e.note ?? undefined })
    }
  }
  for (const e of exContacts) {
    const phoneHit = !!subPhone && normPhone(e.phone) === subPhone
    const emailHit = !!subEmail && norm(e.email) === subEmail
    const nameHit = !!subName && !!e.name && norm(e.name) === subName
    if (phoneHit || emailHit || nameHit) exclusions.push({ kind: "contact", reason: e.reason, note: e.note ?? undefined })
  }
  for (const e of exZones) {
    const v = norm(e.value)
    if ((!!subZip && normZip(e.value) === subZip) || (!!subCity && v === subCity)) {
      exclusions.push({ kind: "zone", reason: e.reason, note: e.note ?? undefined })
    }
  }

  return { outsideServiceArea, exclusions }
}
