import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError } from "./errors"
import { evaluateIntake } from "./intake-eval"
import { createLead } from "./leads"
import { createEstimate } from "./estimates"
import { enforceIntakeLimits, INTAKE_LIMITS } from "../public-intake"
import type { z } from "zod"
import type { quoteRequestCreateSchema, publicQuoteSchema } from "../zod-schemas"

type StaffInput = z.infer<typeof quoteRequestCreateSchema>
type PublicInput = z.infer<typeof publicQuoteSchema>
const toDate = (d?: string) => (d ? new Date(`${d}T00:00:00.000Z`) : null)

export function listQuoteRequests(orgId: string, opts: { status?: string } = {}) {
  return orgDb(orgId).quoteRequest.findMany({
    where: opts.status ? { status: opts.status as "NEW" } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })
}

export function getQuoteRequest(orgId: string, id: string) {
  return orgDb(orgId).quoteRequest.findFirst({ where: { id } })
}

/** Evaluate a quote request's address/contact for staff flags (service area + exclusions). */
export async function evaluateQuoteRequest(orgId: string, id: string) {
  const q = await orgDb(orgId).quoteRequest.findFirst({ where: { id }, select: { addressLine1: true, city: true, state: true, postalCode: true, contactName: true, contactEmail: true, contactPhone: true } })
  if (!q) return null
  return evaluateIntake(orgId, q)
}

export async function createQuoteRequest(orgId: string, input: StaffInput, createdById: string) {
  const evalResult = await evaluateIntake(orgId, input)
  const created = await orgDb(orgId).quoteRequest.create({
    data: {
      organizationId: orgId, source: input.source ?? "PHONE", contactName: input.contactName,
      contactEmail: input.contactEmail, contactPhone: input.contactPhone,
      addressLine1: input.addressLine1, city: input.city, state: input.state, postalCode: input.postalCode,
      propertyType: input.propertyType ?? "RESIDENTIAL", sqft: input.sqft, frequency: input.frequency,
      notes: input.notes, requestedDate: toDate(input.requestedDate),
      walkthrough: input.walkthrough ? (input.walkthrough as object) : undefined,
      outsideServiceArea: evalResult.outsideServiceArea, createdById,
    },
    select: { id: true },
  })
  return { id: created.id, outsideServiceArea: evalResult.outsideServiceArea, exclusions: evalResult.exclusions }
}

export async function updateQuoteRequestStatus(orgId: string, id: string, status: string) {
  const { count } = await orgDb(orgId).quoteRequest.updateMany({ where: { id }, data: { status: status as "NEW" } })
  if (count === 0) return null
  return getQuoteRequest(orgId, id)
}

/**
 * Public online booking. Rate-limited per IP and per org. OUTSIDE the service
 * area → not accepted (caller shows the neutral out-of-area message, and never
 * reveals exclusions). Inside the area → created (source ONLINE); an exclusion
 * is stored as a staff flag but never surfaced to the public.
 */
export async function createPublicQuote(
  orgId: string,
  input: PublicInput,
  ipHash: string,
): Promise<{ accepted: true; id: string } | { accepted: false; reason: "out_of_area" }> {
  const db = orgDb(orgId)
  const now = Date.now()
  const [recentIp, recentOrg] = await Promise.all([
    db.quoteRequest.count({ where: { ipHash, createdAt: { gt: new Date(now - INTAKE_LIMITS.ipWindowMs) } } }),
    db.quoteRequest.count({ where: { createdAt: { gt: new Date(now - INTAKE_LIMITS.orgWindowMs) } } }),
  ])
  enforceIntakeLimits(recentIp, recentOrg) // throws IntakeRejected on abuse

  const evalResult = await evaluateIntake(orgId, input)
  if (evalResult.outsideServiceArea) return { accepted: false, reason: "out_of_area" }

  const created = await db.quoteRequest.create({
    data: {
      organizationId: orgId, source: "ONLINE", contactName: input.contactName,
      contactEmail: input.contactEmail, contactPhone: input.contactPhone,
      addressLine1: input.addressLine1, city: input.city, state: input.state, postalCode: input.postalCode,
      propertyType: input.propertyType ?? "RESIDENTIAL", sqft: input.sqft, frequency: input.frequency, notes: input.notes,
      outsideServiceArea: false, ipHash,
    },
    select: { id: true },
  })
  return { accepted: true, id: created.id }
}

/** Convert a quote request to a Lead and/or an Estimate; link + advance status. */
export async function convertQuoteRequest(orgId: string, id: string, opts: { toLead?: boolean; toEstimate?: boolean }) {
  const q = await orgDb(orgId).quoteRequest.findFirst({ where: { id } })
  assertFound(q, "Quote request")
  if (q!.convertedLeadId || q!.convertedEstimateId) throw new ForbiddenActionError("This quote request has already been converted")
  if (!opts.toLead && !opts.toEstimate) throw new ForbiddenActionError("Choose Lead and/or Estimate to convert to")

  let leadId: string | undefined
  let estimateId: string | undefined
  if (opts.toLead) {
    const lead = await createLead(orgId, { name: q!.contactName, email: q!.contactEmail ?? undefined, phone: q!.contactPhone ?? undefined, source: q!.source, notes: q!.notes ?? undefined })
    leadId = lead.id
  }
  if (opts.toEstimate) {
    const walk = (q!.walkthrough as { name: string; sqft: number; surface: string }[] | null) ?? null
    const est = await createEstimate(orgId, {
      title: `${q!.contactName} — quote`, leadId, contactName: q!.contactName, contactEmail: q!.contactEmail ?? undefined, contactPhone: q!.contactPhone ?? undefined,
      siteName: q!.addressLine1 ?? undefined, addressLine1: q!.addressLine1 ?? undefined, city: q!.city ?? undefined, state: q!.state ?? undefined, postalCode: q!.postalCode ?? undefined,
      frequency: q!.frequency ?? undefined, notes: walk ? `Walkthrough:\n${walk.map((a) => `• ${a.name}: ${a.sqft} sqft ${a.surface}`).join("\n")}` : (q!.notes ?? undefined),
      lines: [],
    })
    estimateId = est.id
  }
  await orgDb(orgId).quoteRequest.updateMany({
    where: { id },
    data: { convertedLeadId: leadId ?? q!.convertedLeadId, convertedEstimateId: estimateId ?? q!.convertedEstimateId, status: estimateId ? "QUOTED" : "CONTACTED" },
  })
  return { leadId, estimateId }
}
