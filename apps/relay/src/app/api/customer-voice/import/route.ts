import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { classifyFeedback } from "@/lib/classify-feedback"

// Simple CSV parser that handles quoted fields
function parseCSV(raw: string): string[][] {
  const rows: string[][] = []
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  for (const line of lines) {
    if (!line.trim()) continue
    const fields: string[] = []
    let inQuote = false
    let cur = ""
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!
      if (ch === '"' && !inQuote) { inQuote = true; continue }
      if (ch === '"' && inQuote) {
        if (line[i + 1] === '"') { cur += '"'; i++; continue }
        inQuote = false; continue
      }
      if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue }
      cur += ch
    }
    fields.push(cur)
    rows.push(fields)
  }
  return rows
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    csvContent?: unknown
    mappings?: unknown  // { fieldName: columnIndex }
  }

  if (typeof body.csvContent !== "string" || !body.csvContent.trim()) {
    return NextResponse.json({ error: "csvContent required" }, { status: 400 })
  }

  const mappings = (body.mappings && typeof body.mappings === "object" && !Array.isArray(body.mappings))
    ? body.mappings as Record<string, number>
    : {}

  const rows = parseCSV(body.csvContent)
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have at least a header row and one data row" }, { status: 400 })

  const [, ...dataRows] = rows  // skip header

  // Cache locations for name matching
  const locations = await prisma.location.findMany({
    where:  { organizationId: session.organizationId },
    select: { id: true, name: true, slug: true },
  })
  const locationByName = new Map(locations.map(l => [l.name.toLowerCase(), l.id]))
  const locationBySlug = new Map(locations.filter(l => l.slug).map(l => [l.slug!.toLowerCase(), l.id]))

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!
    try {
      const get = (field: string): string | undefined =>
        typeof mappings[field] === "number" ? row[mappings[field]!]?.trim() : undefined

      const ratingRaw  = get("rating")
      const text       = get("feedbackText") || null
      const name       = get("customerName") || null
      const email      = get("customerEmail") || null
      const locName    = get("locationName")
      const dateRaw    = get("submittedAt")

      if (!ratingRaw && !text) { skipped++; continue }

      const rating = ratingRaw ? Math.max(1, Math.min(5, Math.round(Number(ratingRaw)))) : null

      let locationId: string | null = null
      if (locName) {
        locationId = locationByName.get(locName.toLowerCase())
          ?? locationBySlug.get(locName.toLowerCase())
          ?? null
      }

      const submittedAt = dateRaw ? new Date(dateRaw) : new Date()
      if (isNaN(submittedAt.getTime())) { errors.push(`Row ${i + 2}: invalid date "${dateRaw}"`); skipped++; continue }

      const effectiveRating = rating ?? 3
      const cls = await classifyFeedback(effectiveRating, text)

      await prisma.customerFeedback.create({
        data: {
          organizationId:  session.organizationId,
          locationId,
          source:          "CSV_IMPORT",
          rating,
          feedbackText:    text,
          customerName:    name,
          customerContact: email,
          submittedAt,
          aiClassification: cls.aiClassification,
          aiSentiment:      cls.aiSentiment,
          aiUrgency:        cls.aiUrgency,
          aiSummary:        cls.aiSummary,
          aiConfidence:     cls.aiConfidence,
          status:           cls.status,
        },
      })
      imported++
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "unknown error"}`)
      skipped++
    }
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 20) })
}
