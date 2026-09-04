import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
    select: { aiSuggestionsOn: true },
  })
  return NextResponse.json({ aiSuggestionsOn: settings?.aiSuggestionsOn ?? true })
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Must not be overridden when feature is off or policy is locked
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true },
  })
  if (!org?.aiSuggestionsAvailable) {
    return NextResponse.json({ error: "AI Suggestions not available for this organization" }, { status: 403 })
  }
  if (org.aiSuggestionsPolicy !== "user_choice") {
    return NextResponse.json({ error: "Org policy does not allow individual override" }, { status: 403 })
  }

  const body = await request.json() as { aiSuggestionsOn?: boolean }
  if (typeof body.aiSuggestionsOn !== "boolean") {
    return NextResponse.json({ error: "aiSuggestionsOn must be boolean" }, { status: 400 })
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: { aiSuggestionsOn: body.aiSuggestionsOn },
    create: { userId: session.userId, aiSuggestionsOn: body.aiSuggestionsOn },
    select: { aiSuggestionsOn: true },
  })
  return NextResponse.json({ aiSuggestionsOn: settings.aiSuggestionsOn })
}
