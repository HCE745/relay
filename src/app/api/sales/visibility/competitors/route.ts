import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const competitors = await prisma.visibilityCompetitor.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json({ competitors })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { name?: string; website?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const competitor = await prisma.visibilityCompetitor.create({
    data: { name: body.name.trim(), website: body.website?.trim() || null },
  })

  return NextResponse.json({ competitor })
}
