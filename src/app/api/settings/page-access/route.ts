import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { CONFIGURABLE_PAGES, ALWAYS_ON, type PageKey, type PageAccessConfig } from "@/lib/page-access"

const VALID_KEYS = new Set(CONFIGURABLE_PAGES.map(p => p.key))

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { role, pages } = body

  if (!role || !Array.isArray(pages)) {
    return NextResponse.json({ error: "role and pages[] are required" }, { status: 400 })
  }

  // Validate all page keys
  const validPages = (pages as string[]).filter(p => VALID_KEYS.has(p as PageKey)) as PageKey[]

  // Enforce always-on pages
  const forced = ALWAYS_ON[role] ?? []
  const merged = Array.from(new Set([...forced, ...validPages]))

  // Load current config and patch the single role
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { pageAccessConfig: true },
  })

  const current = (org?.pageAccessConfig as PageAccessConfig | null) ?? {}
  const updated: PageAccessConfig = { ...current, [role]: merged }

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: { pageAccessConfig: updated },
  })

  return NextResponse.json({ ok: true, role, pages: merged })
}
