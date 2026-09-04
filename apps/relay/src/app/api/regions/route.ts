import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const regions = await prisma.region.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { locations: true, users: true } },
    },
  })

  return NextResponse.json({ regions })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { regions_enabled: true },
  })
  if (!org?.regions_enabled) {
    return NextResponse.json({ error: "Regions feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as { name: string; description?: string }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const region = await prisma.region.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      organizationId: session.organizationId,
    },
  })

  return NextResponse.json({ region })
}
