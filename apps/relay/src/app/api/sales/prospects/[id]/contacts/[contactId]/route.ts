export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contactId } = await params
  const body = await req.json() as {
    name?:                string
    title?:               string
    email?:               string
    verifiedPhone?:       string
    directEmail?:         string
    emailConfidenceScore?: number
    jobLevel?:            string
    department?:          string
    isPrimaryContact?:    boolean
    isDecisionMaker?:     boolean
    isChampion?:          boolean
    linkedinUrl?:         string
    notes?:               string
    verify?:              boolean  // if true, set lastVerifiedAt = now
  }

  const updated = await prisma.prospectContact.update({
    where: { id: contactId },
    data: {
      ...(body.name                !== undefined ? { name:                body.name }                : {}),
      ...(body.title               !== undefined ? { title:               body.title }               : {}),
      ...(body.email               !== undefined ? { email:               body.email }               : {}),
      ...(body.verifiedPhone       !== undefined ? { verifiedPhone:       body.verifiedPhone }       : {}),
      ...(body.directEmail         !== undefined ? { directEmail:         body.directEmail }         : {}),
      ...(body.emailConfidenceScore !== undefined ? { emailConfidenceScore: body.emailConfidenceScore } : {}),
      ...(body.jobLevel            !== undefined ? { jobLevel:            body.jobLevel }            : {}),
      ...(body.department          !== undefined ? { department:          body.department }          : {}),
      ...(typeof body.isPrimaryContact === "boolean" ? { isPrimaryContact: body.isPrimaryContact } : {}),
      ...(typeof body.isDecisionMaker  === "boolean" ? { isDecisionMaker:  body.isDecisionMaker }  : {}),
      ...(typeof body.isChampion       === "boolean" ? { isChampion:       body.isChampion }       : {}),
      ...(body.linkedinUrl         !== undefined ? { linkedinUrl:         body.linkedinUrl }         : {}),
      ...(body.notes               !== undefined ? { notes:               body.notes }               : {}),
      ...(body.verify ? { lastVerifiedAt: new Date() } : {}),
    },
  })

  return NextResponse.json(updated)
}
