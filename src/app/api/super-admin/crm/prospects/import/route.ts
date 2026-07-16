import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ProspectSource } from "@/generated/prisma/enums"

type BulkEntry = { companyName: string; website?: string; industry?: string }

interface DuplicateEntry {
  companyName: string
  existingId: string
}

/**
 * Extract the bare domain from a website string for duplicate matching.
 * Returns null if the URL is unparseable (mirrors prospects/route.ts POST logic).
 */
function extractDomain(website: string): string | null {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/**
 * Check whether a prospect already exists with the same company name or website
 * domain. Mirrors the two-step duplicate check in prospects/route.ts POST.
 * Returns the existing record's id + companyName, or null if no duplicate.
 */
async function findDuplicate(
  companyName: string,
  website: string | undefined
): Promise<{ id: string; companyName: string } | null> {
  // Check 1: case-insensitive company name match
  const nameMatch = await prisma.prospect.findFirst({
    where: { companyName: { equals: companyName, mode: "insensitive" } },
    select: { id: true, companyName: true },
  })
  if (nameMatch) return nameMatch

  // Check 2: website domain match (if a website was supplied)
  if (website) {
    const domain = extractDomain(website)
    if (domain) {
      const domainMatch = await prisma.prospect.findFirst({
        where: { website: { contains: domain, mode: "insensitive" } },
        select: { id: true, companyName: true },
      })
      if (domainMatch) return domainMatch
    }
  }

  return null
}

/**
 * POST /api/super-admin/crm/prospects/import
 *
 * Accepts two shapes:
 *
 * Bulk CSV import:
 *   { prospects: Array<{ companyName: string; website?: string; industry?: string }> }
 *
 * Single manual add (from the "Add Prospect" form):
 *   { companyName: string; website?: string }
 *
 * Returns:
 *   { created: number; skipped: number; duplicates: Array<{ companyName; existingId }>; prospectIds: string[] }
 *
 * Research for newly-created prospects is not triggered here — the UI can
 * initiate it on demand or after polling.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  // ── Determine mode ────────────────────────────────────────────────────────
  const isBulk = Array.isArray(body.prospects)

  let entries: BulkEntry[]
  let source: ProspectSource

  if (isBulk) {
    entries = (body.prospects as unknown[])
      .filter(
        (e): e is BulkEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as BulkEntry).companyName === "string" &&
          (e as BulkEntry).companyName.trim().length > 0
      )
      .map((e) => ({
        companyName: e.companyName.trim(),
        website:     e.website?.trim() || undefined,
        industry:    e.industry?.trim() || undefined,
      }))
    source = ProspectSource.imported
  } else if (
    typeof body.companyName === "string" &&
    body.companyName.trim().length > 0
  ) {
    entries = [
      {
        companyName: (body.companyName as string).trim(),
        website:     typeof body.website === "string" && body.website.trim()
                       ? body.website.trim()
                       : undefined,
      },
    ]
    source = ProspectSource.manual
  } else {
    return NextResponse.json(
      { error: "Invalid request body: supply 'prospects' array or 'companyName' string" },
      { status: 400 }
    )
  }

  if (entries.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, duplicates: [], prospectIds: [] })
  }

  // ── Process each entry ────────────────────────────────────────────────────
  const duplicates: DuplicateEntry[] = []
  const prospectIds: string[] = []
  let createdCount = 0
  let skippedCount = 0

  for (const entry of entries) {
    const existing = await findDuplicate(entry.companyName, entry.website)

    if (existing) {
      duplicates.push({ companyName: entry.companyName, existingId: existing.id })
      skippedCount++
      continue
    }

    const prospect = await prisma.prospect.create({
      data: {
        companyName: entry.companyName,
        website:     entry.website ?? null,
        industry:    entry.industry ?? null,
        source,
      },
      select: { id: true },
    })

    prospectIds.push(prospect.id)
    createdCount++
  }

  return NextResponse.json({
    created:     createdCount,
    skipped:     skippedCount,
    duplicates,
    prospectIds,
  })
}
