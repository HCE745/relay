export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

// POST /api/sales/companies/[id]/contacts — create a new contact
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params

  // Reps can only add contacts to their own assigned prospects
  if (!info.isManager && !info.isSuperAdmin) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { assignedToId: true } })
    if (!prospect || prospect.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }

  const body = await req.json() as {
    name:             string
    title?:           string
    email?:           string
    phone?:           string
    mobile?:          string
    linkedinUrl?:     string
    department?:      string
    jobLevel?:        string
    isPrimaryContact?: boolean
    isDecisionMaker?: boolean
    isChampion?:      boolean
    notes?:           string
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  // If isPrimaryContact = true, demote existing primary
  if (body.isPrimaryContact) {
    await prisma.prospectContact.updateMany({
      where: { prospectId, isPrimaryContact: true },
      data:  { isPrimaryContact: false },
    })
  }

  const contact = await prisma.prospectContact.create({
    data: {
      prospectId,
      name:             body.name.trim(),
      title:            body.title            ?? null,
      email:            body.email            ?? null,
      phone:            body.phone            ?? null,
      mobile:           body.mobile           ?? null,
      linkedinUrl:      body.linkedinUrl       ?? null,
      department:       body.department       ?? null,
      jobLevel:         body.jobLevel         ?? null,
      isPrimaryContact: body.isPrimaryContact ?? false,
      isDecisionMaker:  body.isDecisionMaker  ?? false,
      isChampion:       body.isChampion       ?? false,
      notes:            body.notes            ?? null,
    },
  })

  return NextResponse.json({ contact }, { status: 201 })
}
