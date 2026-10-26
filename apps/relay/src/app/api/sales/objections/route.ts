export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const prospectId    = searchParams.get("prospectId")
  const demoCallId    = searchParams.get("demoCallId")
  const opportunityId = searchParams.get("opportunityId")
  const all           = searchParams.get("all") === "true"

  const objections = await prisma.crmObjection.findMany({
    where: {
      ...(prospectId    ? { prospectId }    : {}),
      ...(demoCallId    ? { demoCallId }    : {}),
      ...(opportunityId ? { opportunityId } : {}),
    },
    include: { salesUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: all ? 500 : 50,
  })

  return NextResponse.json({ objections })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const salesUserId = session.salesUserId
  if (!salesUserId) {
    return NextResponse.json({ error: "Sales user login required" }, { status: 403 })
  }

  const body = await req.json() as {
    prospectId?:    string
    demoCallId?:    string
    opportunityId?: string
    objectionType:  string
    objectionText:  string
    responseGiven?: string
    wasResolved?:   boolean
  }

  if (!body.objectionType || !body.objectionText?.trim()) {
    return NextResponse.json({ error: "objectionType and objectionText required" }, { status: 400 })
  }

  const objection = await prisma.crmObjection.create({
    data: {
      prospectId:    body.prospectId    ?? null,
      demoCallId:    body.demoCallId    ?? null,
      opportunityId: body.opportunityId ?? null,
      salesUserId,
      objectionType: body.objectionType,
      objectionText: body.objectionText.trim(),
      responseGiven: body.responseGiven ?? null,
      wasResolved:   body.wasResolved   ?? false,
    },
    include: { salesUser: { select: { id: true, name: true } } },
  })

  return NextResponse.json(objection, { status: 201 })
}
