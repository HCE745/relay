export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.crmEmailTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { id: true, name: true, subject: true, body: true, isSystem: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ templates, isManager: info.isManager || info.isSuperAdmin })
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isRep) return NextResponse.json({ error: "Only managers can create templates" }, { status: 403 })

  const { name, subject, body } = await req.json() as { name: string; subject: string; body: string }
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 })
  }

  const template = await prisma.crmEmailTemplate.create({
    data: { name: name.trim(), subject: subject.trim(), body: body.trim(), isSystem: false },
  })
  return NextResponse.json({ template }, { status: 201 })
}
