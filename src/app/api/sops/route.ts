import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const category   = searchParams.get("category") || undefined
  const department = searchParams.get("departmentId") || undefined
  const assetType  = searchParams.get("assetType") || undefined

  const sops = await prisma.sOP.findMany({
    where: {
      organizationId: session.organizationId,
      isActive: true,
      ...(category   ? { category }              : {}),
      ...(department ? { departmentId: department } : {}),
      ...(assetType  ? { assetType }              : {}),
    },
    include: {
      department: { select: { id: true, name: true } },
      _count:     { select: { issues: true } },
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  })

  return NextResponse.json(sops)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, category, departmentId, assetType, content, version, uploadedFilename, sections } = body

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
  }

  // For manually created SOPs, parse sections from content if none provided
  let resolvedSections = sections ?? null
  if (!resolvedSections) {
    const { parseSOPSections } = await import("@/lib/sop-matching")
    const parsed = parseSOPSections(content.trim())
    resolvedSections = parsed.length > 1 ? parsed : null
  }

  const sop = await prisma.sOP.create({
    data: {
      organizationId:  session.organizationId,
      title:           title.trim(),
      description:     description?.trim() || null,
      category:        category || null,
      departmentId:    departmentId || null,
      assetType:       assetType || null,
      content:         content.trim(),
      version:         version?.trim() || "1.0",
      uploadedFilename: uploadedFilename?.trim() || null,
      sections:        resolvedSections,
    },
    include: {
      department: { select: { id: true, name: true } },
      _count:     { select: { issues: true } },
    },
  })

  return NextResponse.json(sop, { status: 201 })
}
