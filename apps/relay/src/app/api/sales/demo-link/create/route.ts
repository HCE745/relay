import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

const BASE_URL = "https://app.getrelay.software"

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    prospectId?: string | null
    contactId?:  string | null
    email?:      string | null       // used to look up contact when no IDs provided
    destination?: string | null      // path to link to, defaults to /tour
  }

  let { prospectId, contactId } = body
  const destination = body.destination ?? "/tour"

  // If email provided but no IDs, look up the contact and prospect
  if (body.email && !prospectId && !contactId) {
    const contact = await prisma.prospectContact.findFirst({
      where: { email: body.email },
      select: { id: true, prospectId: true },
    })
    if (contact) {
      contactId  = contact.id
      prospectId = contact.prospectId
    }
  } else if (contactId && !prospectId) {
    // contactId provided but no prospectId — look it up
    const contact = await prisma.prospectContact.findUnique({
      where: { id: contactId },
      select: { prospectId: true },
    })
    if (contact) prospectId = contact.prospectId
  }

  const token = randomBytes(9).toString("base64url").slice(0, 12)

  await prisma.linkClick.create({
    data: {
      token,
      destinationUrl: `${BASE_URL}${destination}`,
      prospectId:  prospectId  ?? null,
      contactId:   contactId   ?? null,
      salesUserId: info.salesUserId !== "sa" ? info.salesUserId : null,
    },
  })

  return NextResponse.json({
    url:   `${BASE_URL}/t/${token}`,
    token,
  })
}
