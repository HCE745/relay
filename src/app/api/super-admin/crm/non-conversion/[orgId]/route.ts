import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params
  const { reasonCategory, reasonDetail } = await req.json() as {
    reasonCategory: string
    reasonDetail?:  string
  }

  if (!reasonCategory) return NextResponse.json({ error: "reasonCategory required" }, { status: 400 })

  const reason = await prisma.nonConversionReason.create({
    data: {
      organizationId: orgId,
      reasonCategory,
      reasonDetail:   reasonDetail ?? null,
      notedBySAName:  session.name,
    },
  })

  await prisma.crmActivity.create({
    data: {
      organizationId:  orgId,
      eventType:       "non_conversion_logged",
      description:     `Non-conversion reason logged: ${reasonCategory}${reasonDetail ? ` — ${reasonDetail}` : ""}`,
      createdBySAName: session.name,
    },
  })

  return NextResponse.json({ reason })
}
