import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getTemplate } from "@/lib/industry-templates"
import { parseSOPSections } from "@/lib/sop-matching"
import { isWashEssentials } from "@/lib/pricing"
import type { InputJsonValue } from "@prisma/client/runtime/client"

export const dynamic = "force-dynamic"

// POST /api/sops/seed
// Seeds industry-template SOPs for the org's current industry setting.
// Idempotent: existing SOPs by title are skipped rather than re-created.
// Requires ADMIN or MANAGER. Blocked on Wash Essentials.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { industry: true, productLine: true },
  })

  if (isWashEssentials(org?.productLine)) {
    return NextResponse.json(
      { error: "SOPs are not available on the Wash Essentials plan" },
      { status: 403 },
    )
  }

  const industry = org?.industry
  if (!industry) {
    return NextResponse.json(
      { error: "Set your organization's industry before seeding SOPs" },
      { status: 400 },
    )
  }

  const template = getTemplate(industry)
  if (!template.demoSOPs.length) {
    return NextResponse.json({ seeded: 0, skipped: 0, errors: [] })
  }

  // Load existing SOP titles to detect duplicates in one query
  const existingTitles = new Set(
    (await prisma.sOP.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { title: true },
    })).map(s => s.title.toLowerCase()),
  )

  const seededIds: string[] = []
  const skippedTitles: string[] = []
  const errors: string[] = []

  for (const sop of template.demoSOPs) {
    if (existingTitles.has(sop.title.toLowerCase())) {
      skippedTitles.push(sop.title)
      continue
    }

    try {
      const sections = parseSOPSections(sop.content)
      const record = await prisma.sOP.create({
        data: {
          organizationId: session.organizationId,
          title:          sop.title,
          description:    sop.description || null,
          category:       sop.category   || null,
          assetType:      sop.assetType  || null,
          version:        sop.version    || "1.0",
          content:        sop.content,
          sections:       sections.length > 1
            ? (sections as unknown as InputJsonValue)
            : undefined,
        },
      })
      seededIds.push(record.id)
      existingTitles.add(sop.title.toLowerCase())
    } catch {
      errors.push(`Failed to seed "${sop.title}"`)
    }
  }

  return NextResponse.json({ seeded: seededIds.length, skipped: skippedTitles.length, errors })
}
