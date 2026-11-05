export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSales() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserId ? s : null
}

// POST /api/sales/companies/[id]/contacts — create a new contact
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params
  const body = await req.json() as {
    name:             string
    title?:           string
    email?:           string
    phone?:           string
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
