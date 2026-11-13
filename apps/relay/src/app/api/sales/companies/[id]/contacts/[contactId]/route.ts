export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSales() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserId ? s : null
}

type Params = { id: string; contactId: string }

// PATCH /api/sales/companies/[id]/contacts/[contactId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId, contactId } = await params
  const body = await req.json() as Record<string, unknown>

  if (body.isPrimaryContact) {
    await prisma.prospectContact.updateMany({
      where: { prospectId, isPrimaryContact: true, id: { not: contactId } },
      data:  { isPrimaryContact: false },
    })
  }

  const contact = await prisma.prospectContact.update({
    where: { id: contactId },
    data:  {
      ...(body.name             !== undefined && { name:             body.name as string }),
      ...(body.title            !== undefined && { title:            body.title as string | null }),
      ...(body.email            !== undefined && { email:            body.email as string | null }),
      ...(body.phone            !== undefined && { phone:            body.phone as string | null }),
      ...(body.mobile           !== undefined && { mobile:           body.mobile as string | null }),
      ...(body.linkedinUrl      !== undefined && { linkedinUrl:      body.linkedinUrl as string | null }),
      ...(body.department       !== undefined && { department:       body.department as string | null }),
      ...(body.jobLevel         !== undefined && { jobLevel:         body.jobLevel as string | null }),
      ...(body.isPrimaryContact !== undefined && { isPrimaryContact: body.isPrimaryContact as boolean }),
      ...(body.isDecisionMaker  !== undefined && { isDecisionMaker:  body.isDecisionMaker as boolean }),
      ...(body.isChampion       !== undefined && { isChampion:       body.isChampion as boolean }),
      ...(body.notes            !== undefined && { notes:            body.notes as string | null }),
    },
  })

  return NextResponse.json({ contact })
}

// DELETE /api/sales/companies/[id]/contacts/[contactId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await params
  await prisma.prospectContact.delete({ where: { id: contactId } })
  return NextResponse.json({ ok: true })
}
