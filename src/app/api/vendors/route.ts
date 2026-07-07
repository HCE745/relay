import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const vendors = await prisma.vendor.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { issues: true, assets: true } } },
  })
  return NextResponse.json(vendors)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { name, contactName, email, phone, address, specialty, notes } = body
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const vendor = await prisma.vendor.create({
    data: {
      name,
      contactName: contactName || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      specialty: specialty || null,
      notes: notes || null,
      organizationId: session.organizationId,
    },
  })
  return NextResponse.json(vendor, { status: 201 })
}
