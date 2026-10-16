import { randomBytes } from "node:crypto"
import { orgDb, systemDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { estimatePdfData } from "./documents"
import { convertEstimate } from "./estimates"
import { renderProposalPdf, type ProposalPdfData } from "../pdf/render"
import type { Prisma } from "../../generated/prisma/client"

// Proposals & e-signature (Phase 27). A proposal freezes an estimate's content
// (snapshot) and is accepted via a public tokenized link with a typed-name
// e-signature. Acceptance runs the existing atomic estimate→customer conversion.

export async function createProposal(orgId: string, estimateId: string, terms: string | undefined, createdById: string) {
  const existing = await orgDb(orgId).proposal.findFirst({ where: { estimateId } })
  if (existing) {
    if (existing.status === "ACCEPTED") throw new ConflictError("This estimate's proposal is already accepted")
    return existing // one proposal per estimate; reuse the draft
  }
  const r = await estimatePdfData(orgId, estimateId)
  assertFound(r, "Estimate")
  const token = randomBytes(24).toString("base64url")
  return orgDb(orgId).proposal.create({
    data: { organizationId: orgId, estimateId, token, terms, snapshot: r!.data as unknown as Prisma.InputJsonValue, createdById },
  })
}

export async function sendProposal(orgId: string, id: string) {
  const p = await orgDb(orgId).proposal.findFirst({ where: { id }, select: { status: true } })
  assertFound(p, "Proposal")
  if (p!.status === "ACCEPTED") throw new ConflictError("Already accepted")
  await orgDb(orgId).proposal.updateMany({ where: { id }, data: { status: "SENT", sentAt: new Date() } })
  return orgDb(orgId).proposal.findFirst({ where: { id } })
}

export function getProposalForEstimate(orgId: string, estimateId: string) {
  return orgDb(orgId).proposal.findFirst({ where: { estimateId }, select: { id: true, token: true, status: true } })
}

export function listProposalsForCustomer(orgId: string, customerId: string) {
  return orgDb(orgId).proposal.findMany({ where: { convertedCustomerId: customerId }, orderBy: { signedAt: "desc" } })
}

/** Public, login-free view by token. */
export async function getProposalByToken(token: string) {
  const p = await systemDb.proposal.findFirst({
    where: { token },
    select: { id: true, organizationId: true, status: true, snapshot: true, terms: true, signerName: true, signedAt: true },
  })
  if (!p) return null
  return { ...p, snapshot: p.snapshot as unknown as ProposalPdfData }
}

export async function proposalPdfByToken(token: string): Promise<Buffer | null> {
  const p = await systemDb.proposal.findFirst({ where: { token }, select: { snapshot: true, terms: true, signerName: true, signedAt: true, signerIp: true } })
  if (!p) return null
  const data = p.snapshot as unknown as ProposalPdfData
  return renderProposalPdf({
    ...data,
    terms: p.terms ?? undefined,
    signature: p.signerName && p.signedAt ? { name: p.signerName, signedAt: p.signedAt.toISOString().slice(0, 16).replace("T", " "), ip: p.signerIp ?? "-" } : undefined,
  })
}

/**
 * Accept a proposal via the public link: record the typed-name e-signature
 * (name, IP, timestamp, user agent), then run the atomic estimate conversion.
 * One-shot and immutable thereafter.
 */
export async function acceptProposal(token: string, sig: { signerName: string; ip: string; userAgent: string }) {
  const p = await systemDb.proposal.findFirst({ where: { token }, select: { id: true, organizationId: true, estimateId: true, status: true } })
  if (!p) throw new ConflictError("This proposal link is not valid")
  if (p.status === "ACCEPTED") throw new ConflictError("This proposal was already accepted")
  if (p.status === "DECLINED") throw new ConflictError("This proposal was declined")

  // The proposal acceptance IS the estimate acceptance — mark it, then convert.
  await orgDb(p.organizationId).estimate.updateMany({ where: { id: p.estimateId, convertedCustomerId: null }, data: { status: "ACCEPTED" } })
  // Convert the estimate (atomic, idempotent-guarded in convertEstimate).
  const conv = await convertEstimate(p.organizationId, p.estimateId)
  await orgDb(p.organizationId).proposal.updateMany({
    where: { id: p.id, status: { not: "ACCEPTED" } },
    data: { status: "ACCEPTED", signerName: sig.signerName, signerIp: sig.ip, signerUserAgent: sig.userAgent.slice(0, 500), signedAt: new Date(), convertedCustomerId: conv.customerId },
  })
  return { customerId: conv.customerId }
}

export async function declineProposal(token: string) {
  const p = await systemDb.proposal.findFirst({ where: { token }, select: { id: true, organizationId: true, status: true } })
  if (!p) throw new ConflictError("This proposal link is not valid")
  if (p.status === "ACCEPTED") throw new ConflictError("This proposal was already accepted")
  await orgDb(p.organizationId).proposal.updateMany({ where: { id: p.id }, data: { status: "DECLINED" } })
  return { ok: true }
}
