import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headersList = await headers()
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
    headersList.get("x-real-ip") ||
    null

  await prisma.legalAcceptance.create({
    data: {
      userId:                  session.userId,
      organizationId:          session.organizationId,
      termsVersion:            CURRENT_TERMS_VERSION,
      privacyVersion:          CURRENT_PRIVACY_VERSION,
      ipAddress:               ip,
      aiDisclaimerAcknowledged: true,
    },
  })

  return NextResponse.json({ ok: true })
}
