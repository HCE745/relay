import { orgDb, systemDb } from "../org-db"
import { assertFound, ForbiddenActionError } from "./errors"
import { resolveCapabilities, parseOverrides, type PackageTier } from "../entitlements"
import { Prisma } from "../../generated/prisma/client"

// Capability check without the server-only page-guards import (for the data layer).
async function orgHasSopLibrary(orgId: string): Promise<boolean> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { packageTier: true, capabilityOverrides: true } })
  if (!org) return false
  return resolveCapabilities({ packageTier: org.packageTier as PackageTier, capabilityOverrides: parseOverrides(org.capabilityOverrides) }).has("operations.sopLibrary")
}

/** Warn (not block) when assigning someone to a site that has a required SOP the
 *  person hasn't acknowledged. Returns [] when the feature is off. */
export async function sopAssignmentWarnings(orgId: string, userId: string, role: string, siteId: string): Promise<string[]> {
  if (!(await orgHasSopLibrary(orgId))) return []
  const sops = await orgDb(orgId).sop.findMany({
    where: { status: "PUBLISHED", requiresAck: true, OR: [{ appliesEveryone: true }, { appliesRoles: { has: role } }, { appliesSiteIds: { has: siteId } }] },
    select: { id: true, title: true },
  })
  const warnings: string[] = []
  for (const s of sops) if (!(await hasAckedCurrent(orgId, userId, s.id))) warnings.push(`Unacknowledged SOP: ${s.title}`)
  return warnings
}

// SOP library (Phase 39). NO AI: search returns the org's own approved text,
// never generated/summarized. Versions are immutable snapshots (prior versions
// readable forever); sections are the unit of search and linking.

export type SopSectionInput = { heading: string; body: string }
export type SopInput = {
  title: string; category: string; keywords?: string | null; attachmentUrl?: string | null
  requiresAck?: boolean; reackIntervalDays?: number | null
  appliesEveryone?: boolean; appliesRoles?: string[]; appliesSiteIds?: string[]; appliesServicePlanIds?: string[]
  sections: SopSectionInput[]
}

const CATEGORIES = ["SAFETY", "CHEMICAL", "EQUIPMENT", "SERVICE_PROCEDURE", "SITE_SPECIFIC", "HR", "EMERGENCY"]
const cat = (c: string) => c as Prisma.SopCreateInput["category"]

// ── Authoring (OWNER/ADMIN/MANAGER; enforced at the route) ────────────────────

/** Create a DRAFT SOP with version 1 (unpublished) and its sections. */
export async function createSop(orgId: string, actorId: string, input: SopInput) {
  if (!CATEGORIES.includes(input.category)) throw new ForbiddenActionError("Unknown SOP category")
  const db = orgDb(orgId)
  const sop = await db.sop.create({
    data: {
      organizationId: orgId, title: input.title, category: cat(input.category), status: "DRAFT", currentVersion: 1,
      keywords: input.keywords ?? null, attachmentUrl: input.attachmentUrl ?? null,
      requiresAck: input.requiresAck ?? false, reackIntervalDays: input.reackIntervalDays ?? null,
      appliesEveryone: input.appliesEveryone ?? true, appliesRoles: input.appliesRoles ?? [],
      appliesSiteIds: input.appliesSiteIds ?? [], appliesServicePlanIds: input.appliesServicePlanIds ?? [],
      createdById: actorId,
    },
    select: { id: true },
  })
  await writeVersion(orgId, sop.id, 1, input, actorId)
  return { id: sop.id }
}

// Replace a version's metadata + sections (drafts only). Sections carry a
// denormalized title/keywords so the FTS vector covers title/keyword hits.
async function writeVersion(orgId: string, sopId: string, version: number, input: SopInput, actorId: string, published = false) {
  const db = orgDb(orgId)
  await db.sopVersion.deleteMany({ where: { sopId, version } }) // replace if re-saving a draft
  const v = await db.sopVersion.create({
    data: {
      organizationId: orgId, sopId, version, title: input.title, category: cat(input.category),
      keywords: input.keywords ?? null, attachmentUrl: input.attachmentUrl ?? null,
      publishedAt: published ? new Date() : null, createdById: actorId,
    },
    select: { id: true },
  })
  const kw = (input.keywords ?? "").trim()
  await db.sopSection.createMany({
    data: input.sections.map((s, i) => ({ organizationId: orgId, sopVersionId: v.id, orderIndex: i, heading: s.heading, body: s.body, sopTitle: input.title, keywords: kw })),
  })
  return v.id
}

/** Edit the working DRAFT in place. Allowed only while the current version is a
 *  draft (never published). A published version is immutable — use reviseSop. */
export async function updateSopDraft(orgId: string, id: string, actorId: string, input: SopInput) {
  const db = orgDb(orgId)
  const sop = await db.sop.findFirst({ where: { id }, select: { currentVersion: true } })
  assertFound(sop, "SOP")
  const current = await db.sopVersion.findFirst({ where: { sopId: id, version: sop!.currentVersion }, select: { publishedAt: true } })
  if (current?.publishedAt) throw new ForbiddenActionError("This version is published and immutable. Revise it to create a new version.")
  await db.sop.updateMany({ where: { id }, data: {
    title: input.title, category: cat(input.category), keywords: input.keywords ?? null, attachmentUrl: input.attachmentUrl ?? null,
    requiresAck: input.requiresAck ?? false, reackIntervalDays: input.reackIntervalDays ?? null,
    appliesEveryone: input.appliesEveryone ?? true, appliesRoles: input.appliesRoles ?? [], appliesSiteIds: input.appliesSiteIds ?? [], appliesServicePlanIds: input.appliesServicePlanIds ?? [],
  } })
  await writeVersion(orgId, id, sop!.currentVersion, input, actorId)
  return { id }
}

/** Publish the current draft version. Sets publishedAt + the SOP effectiveDate. */
export async function publishSop(orgId: string, id: string) {
  const db = orgDb(orgId)
  const sop = await db.sop.findFirst({ where: { id }, select: { currentVersion: true, status: true } })
  assertFound(sop, "SOP")
  const now = new Date()
  await db.sopVersion.updateMany({ where: { sopId: id, version: sop!.currentVersion, publishedAt: null }, data: { publishedAt: now } })
  await db.sop.updateMany({ where: { id }, data: { status: "PUBLISHED", effectiveDate: now } })
  return { id }
}

/** Begin a revision of a PUBLISHED SOP: copy the current published sections into
 *  a new unpublished draft version (currentVersion + 1). The published version
 *  stays live and readable until the new draft is published. */
export async function reviseSop(orgId: string, id: string, actorId: string) {
  const db = orgDb(orgId)
  const sop = await db.sop.findFirst({ where: { id }, select: { currentVersion: true, title: true, category: true, keywords: true, attachmentUrl: true } })
  assertFound(sop, "SOP")
  const currentV = await db.sopVersion.findFirst({ where: { sopId: id, version: sop!.currentVersion }, select: { publishedAt: true } })
  if (!currentV?.publishedAt) return { id, version: sop!.currentVersion } // already a draft in progress
  const sections = await db.sopSection.findMany({ where: { sopVersionId: (await db.sopVersion.findFirstOrThrow({ where: { sopId: id, version: sop!.currentVersion }, select: { id: true } })).id }, orderBy: { orderIndex: "asc" }, select: { heading: true, body: true } })
  const next = sop!.currentVersion + 1
  await db.sop.updateMany({ where: { id }, data: { currentVersion: next } })
  await writeVersion(orgId, id, next, { title: sop!.title, category: sop!.category, keywords: sop!.keywords, attachmentUrl: sop!.attachmentUrl, sections }, actorId)
  return { id, version: next }
}

export async function archiveSop(orgId: string, id: string) {
  const sop = await orgDb(orgId).sop.findFirst({ where: { id }, select: { id: true } })
  assertFound(sop, "SOP")
  await orgDb(orgId).sop.updateMany({ where: { id }, data: { status: "ARCHIVED" } })
  return { id }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Sites + service plans for the editor's applicability pickers. */
export async function sopFormOptions(orgId: string) {
  const db = orgDb(orgId)
  const [sites, plans] = await Promise.all([
    db.serviceLocation.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.servicePlan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  return { sites, plans }
}

/** All published SOPs for the issue-category mapping picker. */
export function listPublishedSops(orgId: string) {
  return orgDb(orgId).sop.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true, category: true } })
}

export function listIssueMappings(orgId: string) {
  return orgDb(orgId).sopIssueMapping.findMany({ include: { sop: { select: { id: true, title: true } } }, orderBy: { issueCategory: "asc" } })
}

export function listSops(orgId: string) {
  return orgDb(orgId).sop.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
    include: { _count: { select: { acknowledgments: true } } },
  })
}

/** The latest published version number of a SOP (null if never published). */
async function publishedVersionNum(orgId: string, sopId: string): Promise<number | null> {
  const v = await orgDb(orgId).sopVersion.findFirst({ where: { sopId, publishedAt: { not: null } }, orderBy: { version: "desc" }, select: { version: true } })
  return v?.version ?? null
}

async function versionWithSections(orgId: string, sopId: string, version: number) {
  const v = await orgDb(orgId).sopVersion.findFirst({
    where: { sopId, version },
    include: { sections: { orderBy: { orderIndex: "asc" } }, sop: { select: { title: true, category: true, status: true, requiresAck: true, reackIntervalDays: true, attachmentUrl: true, effectiveDate: true, appliesEveryone: true, appliesRoles: true } } },
  })
  return v
}

/** Reader view: the latest PUBLISHED version + sections (what a cleaner reads). */
export async function getPublishedSop(orgId: string, sopId: string) {
  const pv = await publishedVersionNum(orgId, sopId)
  if (pv == null) return null
  return versionWithSections(orgId, sopId, pv)
}

/** A specific historical version (prior versions readable forever). */
export function getSopVersion(orgId: string, sopId: string, version: number) {
  return versionWithSections(orgId, sopId, version)
}

/** Editor view: the working version (may be a draft) + sections + version list. */
export async function getSopForEdit(orgId: string, sopId: string) {
  const sop = await orgDb(orgId).sop.findFirst({ where: { id: sopId } })
  if (!sop) return null
  const current = await versionWithSections(orgId, sopId, sop.currentVersion)
  const versions = await orgDb(orgId).sopVersion.findMany({ where: { sopId }, orderBy: { version: "desc" }, select: { version: true, publishedAt: true } })
  const publishedVersion = await publishedVersionNum(orgId, sopId)
  return { sop, current, versions, publishedVersion }
}

// ── Section-level full-text search (Postgres FTS; no external service) ─────────

export type SectionHit = { sectionId: string; sopId: string; version: number; sopTitle: string; category: string; heading: string; snippet: string; applicable: boolean }

export async function searchSections(orgId: string, qRaw: string, ctx: { role: string }): Promise<SectionHit[]> {
  const q = qRaw.trim()
  if (!q) return []
  type Row = { sectionId: string; sopId: string; version: number; sopTitle: string; category: string; heading: string; snippet: string; appliesEveryone: boolean; appliesRoles: string[]; rank: number }
  // Only the CURRENT published version of each non-archived SOP is searchable.
  const rows = await systemDb.$queryRaw<Row[]>`
    SELECT sec.id AS "sectionId", v."sopId" AS "sopId", v.version AS "version", s.title AS "sopTitle",
           s.category::text AS "category", sec.heading AS "heading",
           ts_headline('english', sec.body, websearch_to_tsquery('english', ${q}), 'StartSel=«,StopSel=»,MaxFragments=1,MinWords=6,MaxWords=20') AS "snippet",
           s."appliesEveryone" AS "appliesEveryone", s."appliesRoles" AS "appliesRoles",
           ts_rank(sec."searchVector", websearch_to_tsquery('english', ${q})) AS "rank"
    FROM "cleaning"."SopSection" sec
    JOIN "cleaning"."SopVersion" v ON v.id = sec."sopVersionId"
    JOIN "cleaning"."Sop" s ON s.id = v."sopId"
    WHERE sec."organizationId" = ${orgId}
      AND s.status = 'PUBLISHED'
      AND v."publishedAt" IS NOT NULL
      AND v.version = (SELECT max(v2.version) FROM "cleaning"."SopVersion" v2 WHERE v2."sopId" = v."sopId" AND v2."publishedAt" IS NOT NULL)
      AND sec."searchVector" @@ websearch_to_tsquery('english', ${q})
    ORDER BY "rank" DESC
    LIMIT 30`
  // Applicable-to-me SOPs rank above others; relevance is the tiebreak.
  const withApp = rows.map((r) => ({ ...r, applicable: r.appliesEveryone || r.appliesRoles.includes(ctx.role) }))
  withApp.sort((a, b) => (a.applicable === b.applicable ? b.rank - a.rank : a.applicable ? -1 : 1))
  return withApp.map((r) => ({ sectionId: r.sectionId, sopId: r.sopId, version: r.version, sopTitle: r.sopTitle, category: r.category, heading: r.heading, snippet: r.snippet, applicable: r.applicable }))
}

// ── Applicability ─────────────────────────────────────────────────────────────

/** Published SOPs that apply to a user (everyone or their role). */
export function sopsForUser(orgId: string, role: string) {
  return orgDb(orgId).sop.findMany({
    where: { status: "PUBLISHED", OR: [{ appliesEveryone: true }, { appliesRoles: { has: role } }] },
    orderBy: { title: "asc" },
    select: { id: true, title: true, category: true, requiresAck: true },
  })
}

/** Published SOPs posted to a specific site (for the job screen). */
export function sopsForSite(orgId: string, siteId: string) {
  return orgDb(orgId).sop.findMany({
    where: { status: "PUBLISHED", OR: [{ appliesEveryone: true }, { appliesSiteIds: { has: siteId } }] },
    orderBy: { title: "asc" },
    select: { id: true, title: true, category: true },
  })
}

/** SOPs mapped to an issue category (admin-configured; no inference). */
export async function sopsForIssueCategory(orgId: string, category: string) {
  const maps = await orgDb(orgId).sopIssueMapping.findMany({
    where: { issueCategory: category as Prisma.SopIssueMappingWhereInput["issueCategory"], sop: { status: "PUBLISHED" } },
    select: { sop: { select: { id: true, title: true, category: true } } },
  })
  return maps.map((m) => m.sop)
}

// ── Acknowledgment ──────────────────────────────────────────────────────────

/** Record that a user read the current published version. Immutable + unique. */
export async function acknowledgeSop(orgId: string, userId: string, sopId: string) {
  const pv = await publishedVersionNum(orgId, sopId)
  if (pv == null) throw new ForbiddenActionError("This SOP is not published")
  try {
    await orgDb(orgId).sopAcknowledgment.create({ data: { organizationId: orgId, sopId, userId, version: pv } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { id: sopId, already: true }
    throw e
  }
  return { id: sopId, already: false }
}

/** Whether a user has acknowledged the current published version of a SOP. */
export async function hasAckedCurrent(orgId: string, userId: string, sopId: string): Promise<boolean> {
  const pv = await publishedVersionNum(orgId, sopId)
  if (pv == null) return false
  const a = await orgDb(orgId).sopAcknowledgment.findFirst({ where: { sopId, userId, version: pv }, select: { id: true } })
  return !!a
}

/** A user's outstanding required acknowledgments: applicable, requiresAck SOPs
 *  the user hasn't acked at the current version (or whose ack has expired). */
export async function outstandingAcks(orgId: string, userId: string, role: string, now: Date = new Date()) {
  const db = orgDb(orgId)
  const sops = await db.sop.findMany({
    where: { status: "PUBLISHED", requiresAck: true, OR: [{ appliesEveryone: true }, { appliesRoles: { has: role } }] },
    select: { id: true, title: true, category: true, reackIntervalDays: true },
  })
  const out: { id: string; title: string; category: string; reason: "never" | "new_version" | "expired" }[] = []
  for (const s of sops) {
    const pv = await publishedVersionNum(orgId, s.id)
    if (pv == null) continue
    // The relevant ack is the one for the CURRENT version; expiry is measured from it.
    const currentAck = await db.sopAcknowledgment.findFirst({ where: { sopId: s.id, userId, version: pv }, select: { acknowledgedAt: true } })
    if (!currentAck) {
      const anyAck = await db.sopAcknowledgment.findFirst({ where: { sopId: s.id, userId }, select: { id: true } })
      out.push({ ...s, reason: anyAck ? "new_version" : "never" })
      continue
    }
    if (s.reackIntervalDays && now.getTime() - currentAck.acknowledgedAt.getTime() > s.reackIntervalDays * 86_400_000) out.push({ ...s, reason: "expired" })
  }
  return out
}

/** Summary across all required SOPs: how many are current vs outstanding. */
export async function complianceSummary(orgId: string, now: Date = new Date()) {
  const sops = await orgDb(orgId).sop.findMany({ where: { status: "PUBLISHED", requiresAck: true }, orderBy: { title: "asc" }, select: { id: true, title: true, category: true } })
  const out = []
  for (const s of sops) {
    const c = await complianceForSop(orgId, s.id, now)
    out.push({ id: s.id, title: s.title, category: s.category, total: c.rows.length, current: c.rows.filter((r) => r.status === "current").length, outstanding: c.rows.filter((r) => r.status !== "current").length })
  }
  return out
}

// ── Compliance (manager view + export) ────────────────────────────────────────

/** Who has acknowledged a SOP and who is outstanding (credential-tracking shape). */
export async function complianceForSop(orgId: string, sopId: string, now: Date = new Date()) {
  const db = orgDb(orgId)
  const sop = await db.sop.findFirst({ where: { id: sopId }, select: { id: true, title: true, requiresAck: true, reackIntervalDays: true, appliesEveryone: true, appliesRoles: true } })
  assertFound(sop, "SOP")
  const pv = await publishedVersionNum(orgId, sopId)
  type RoleArr = ("OWNER" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CLEANER")[]
  // Everyone → all staff; role-targeted → those roles; targeted-but-empty → nobody.
  const roleScope = sop!.appliesEveryone
    ? { role: { not: "CLIENT" as const } }
    : sop!.appliesRoles.length
      ? { role: { in: sop!.appliesRoles as RoleArr } }
      : { id: "___never___" }
  const users = await db.user.findMany({
    where: { isActive: true, ...roleScope },
    select: { id: true, name: true, role: true },
  })
  const acks = await db.sopAcknowledgment.findMany({ where: { sopId }, orderBy: { version: "desc" }, select: { userId: true, version: true, acknowledgedAt: true } })
  // Per user: the highest-version ack (for display) and the current-version ack (for status).
  const topByUser = new Map<string, { version: number; acknowledgedAt: Date }>()
  const currentByUser = new Map<string, { acknowledgedAt: Date }>()
  for (const a of acks) {
    if (!topByUser.has(a.userId)) topByUser.set(a.userId, a)
    if (pv != null && a.version === pv && !currentByUser.has(a.userId)) currentByUser.set(a.userId, a)
  }
  return {
    sop: sop!, publishedVersion: pv,
    rows: users.map((u) => {
      const top = topByUser.get(u.id)
      const cur = currentByUser.get(u.id)
      const expired = !!(cur && sop!.reackIntervalDays && now.getTime() - cur.acknowledgedAt.getTime() > sop!.reackIntervalDays * 86_400_000)
      const status = cur ? (expired ? "expired" : "current") : top ? "outdated" : "outstanding"
      return { userId: u.id, name: u.name, role: u.role, acknowledgedVersion: top?.version ?? null, acknowledgedAt: top?.acknowledgedAt ?? null, status }
    }),
  }
}
