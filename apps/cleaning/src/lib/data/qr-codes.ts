import { randomBytes } from "node:crypto"
import { orgDb, systemDb } from "../org-db"
import { assertFound } from "./errors"
import { recordAudit } from "./audit"
import { issueSlaFields } from "./issues"
import { applyRouting } from "./issue-routing"
import { notifyManagers } from "../notify"
import { INTAKE_LIMITS, enforceIntakeLimits } from "../public-intake"

// QR operational reporting (Phase 32). Occupants scan a posted code and file an
// issue with no login. The public write path reuses the Phase 2.3 defenses: a
// trustworthy-IP token bucket (in the route), a per-IP + per-org DURABLE row cap
// (here), and a honeypot. External reports are flagged (source QR, no internal
// reporter) and stay org-isolated like any other tenant row.

const PUBLIC_CATEGORIES = ["QUALITY", "SUPPLIES", "SAFETY", "ACCESS", "OTHER"] as const
export type PublicIssueCategory = (typeof PUBLIC_CATEGORIES)[number]

// ── Management ────────────────────────────────────────────────────────────────

export function listQrCodes(orgId: string) {
  return orgDb(orgId).qrCode.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } }, _count: { select: { issues: true } } },
  })
}

export function getQrCode(orgId: string, id: string) {
  return orgDb(orgId).qrCode.findFirst({
    where: { id },
    include: { serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } } },
  })
}

export async function createQrCode(orgId: string, actorId: string, input: { serviceLocationId: string; label: string }) {
  const db = orgDb(orgId)
  const site = await db.serviceLocation.findFirst({ where: { id: input.serviceLocationId }, select: { id: true } })
  assertFound(site, "Service location")
  const token = randomBytes(9).toString("base64url") // 12 url-safe chars, unguessable
  const code = await db.qrCode.create({
    data: { organizationId: orgId, serviceLocationId: input.serviceLocationId, label: input.label, token, createdById: actorId },
    select: { id: true, token: true },
  })
  await recordAudit(orgId, actorId, "QrCode", code.id, "create", { newValue: input.label })
  return code
}

/** Revoke (deactivate) ONE code. Others keep working — no reprinting. */
export async function setQrCodeActive(orgId: string, actorId: string, id: string, isActive: boolean) {
  const db = orgDb(orgId)
  const code = await db.qrCode.findFirst({ where: { id }, select: { id: true, label: true } })
  assertFound(code, "QR code")
  await db.qrCode.updateMany({ where: { id }, data: { isActive } })
  await recordAudit(orgId, actorId, "QrCode", id, isActive ? "reactivate" : "revoke", { newValue: code!.label })
  return { id }
}

/** Issues filed through a specific code — the code's report history. */
export function listQrCodeReports(orgId: string, qrCodeId: string) {
  return orgDb(orgId).issue.findMany({
    where: { qrCodeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, category: true, severity: true, status: true, description: true, externalReporter: true, createdAt: true },
  })
}

// ── Public (unauthenticated) ────────────────────────────────────────────────

/** Resolve a public token → the org + site label. systemDb: no org context yet. */
export async function getPublicQrInfo(token: string) {
  const code = await systemDb.qrCode.findUnique({
    where: { token },
    select: { id: true, organizationId: true, serviceLocationId: true, label: true, isActive: true,
      organization: { select: { name: true } }, serviceLocation: { select: { name: true } } },
  })
  if (!code) return null
  return { organizationName: code.organization.name, siteName: code.serviceLocation.name, label: code.label, isActive: code.isActive }
}

/** A scan (page view) — cheap single-row counter; no per-view rows (flood-safe). */
export async function recordQrScan(token: string) {
  await systemDb.qrCode.updateMany({ where: { token }, data: { scanCount: { increment: 1 }, lastScanAt: new Date() } })
}

export type PublicQrIssueInput = { category?: PublicIssueCategory; description: string; reporterName?: string; reporterContact?: string }

/**
 * Public QR submission. Resolves the token, enforces the durable per-IP/per-org
 * caps, and files an EXTERNAL issue (source QR, no internal reporter) routed by
 * the normal rules. Returns a short human reference, or null if the code is
 * missing/revoked (the route turns that into a neutral 404).
 */
export async function submitQrIssue(token: string, input: PublicQrIssueInput, ipHash: string): Promise<{ reference: string } | null> {
  const code = await systemDb.qrCode.findUnique({ where: { token }, select: { id: true, organizationId: true, serviceLocationId: true, isActive: true } })
  if (!code || !code.isActive) return null
  const orgId = code.organizationId
  const db = orgDb(orgId)

  const now = Date.now()
  const [recentIp, recentOrg] = await Promise.all([
    db.issue.count({ where: { source: "QR", reporterIpHash: ipHash, createdAt: { gt: new Date(now - INTAKE_LIMITS.ipWindowMs) } } }),
    db.issue.count({ where: { source: "QR", createdAt: { gt: new Date(now - INTAKE_LIMITS.orgWindowMs) } } }),
  ])
  enforceIntakeLimits(recentIp, recentOrg) // throws IntakeRejected on abuse

  const category = (input.category ?? "OTHER") as string
  const sla = await issueSlaFields(orgId, category)
  const external = [input.reporterName?.trim(), input.reporterContact?.trim()].filter(Boolean).join(" · ").slice(0, 200) || "Anonymous (QR)"
  const issue = await db.issue.create({
    data: {
      organizationId: orgId,
      serviceLocationId: code.serviceLocationId,
      qrCodeId: code.id,
      reportedById: null,
      source: "QR",
      category: category as never,
      severity: sla.severity,
      ackDeadline: sla.ackDeadline,
      resolveDeadline: sla.resolveDeadline,
      description: input.description.trim().slice(0, 2000),
      externalReporter: external,
      reporterIpHash: ipHash,
      status: "OPEN",
    },
    select: { id: true },
  })
  await recordAudit(orgId, null, "Issue", issue.id, "report", { metadata: { source: "QR", qrCodeId: code.id } })
  await applyRouting(orgId, issue.id, null, { category, severity: sla.severity, source: "QR", serviceLocationId: code.serviceLocationId })
  await notifyManagers(orgId, "New QR-reported problem", `An occupant reported a problem via a posted QR code. Open Issues to triage.`)
  return { reference: issue.id.slice(-6).toUpperCase() }
}

export { PUBLIC_CATEGORIES }
