// Prospect deduplication and ownership utilities.

import { prisma } from "@/lib/prisma"

/** Normalize a company name for duplicate detection:
 *  lowercase, strip punctuation, remove common suffixes. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, " ")
    .replace(/\b(inc|llc|corp|ltd|co|company|incorporated|limited|llp|lp|plc|gmbh|ag)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Extract the root domain from a URL or email, stripping www. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host.toLowerCase()
  } catch {
    return null
  }
}

export type DuplicateWarning = {
  id: string
  companyName: string
  assignedToName: string | null
  currentCrmStatus: string
}

/** Check for existing prospects that match by company name or domain.
 *  Returns the first match found, or null if none.
 *
 *  Strategy:
 *  1. Domain match — targeted DB query using ILIKE; avoids a full table scan
 *     for the common case where a website is provided.
 *  2. Name match — loads only (id, companyName, assignedToName, currentCrmStatus)
 *     with no row limit and applies normalization in JS. Much smaller payload
 *     than loading full records; reliable at any prospect count. */
export async function findDuplicateProspect(params: {
  companyName: string
  website?: string | null
  excludeId?: string
}): Promise<DuplicateWarning | null> {
  const { companyName, website, excludeId } = params
  const normalized = normalizeCompanyName(companyName)
  const domain = normalizeDomain(website)

  const excludeFilter = excludeId ? { id: { not: excludeId } } : {}

  // ── 1. Domain match via DB query ─────────────────────────────────────────
  if (domain) {
    const domainMatch = await prisma.prospect.findFirst({
      where: {
        ...excludeFilter,
        website: { contains: domain, mode: "insensitive" },
      },
      select: { id: true, companyName: true, assignedToName: true, currentCrmStatus: true },
    })
    if (domainMatch) return domainMatch
  }

  // ── 2. Name match — load minimal columns, no row limit ───────────────────
  const rows = await prisma.prospect.findMany({
    where:  excludeFilter,
    select: { id: true, companyName: true, assignedToName: true, currentCrmStatus: true },
  })

  for (const p of rows) {
    if (normalizeCompanyName(p.companyName) === normalized) return p
  }

  return null
}

/** Validate commission split percentages for an opportunity.
 *  Returns error message if splits don't sum to 100, null if OK. */
export function validateCommissionSplits(splits: { splitPercent: number }[]): string | null {
  if (!splits.length) return null
  const total = splits.reduce((sum, s) => sum + s.splitPercent, 0)
  if (total !== 100) return `Commission splits must sum to 100% (got ${total}%)`
  return null
}
