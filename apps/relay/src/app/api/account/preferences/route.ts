import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as { aiSuggestionsCollapsed?: boolean; sopPanelsCollapsed?: boolean; darkMode?: boolean }

  const updateData: { aiSuggestionsCollapsed?: boolean; sopPanelsCollapsed?: boolean; darkMode?: boolean } = {}
  if (typeof body.aiSuggestionsCollapsed === "boolean") updateData.aiSuggestionsCollapsed = body.aiSuggestionsCollapsed
  if (typeof body.sopPanelsCollapsed === "boolean")     updateData.sopPanelsCollapsed     = body.sopPanelsCollapsed
  if (typeof body.darkMode === "boolean")               updateData.darkMode               = body.darkMode

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 })
  }

  const settings = await prisma.userSettings.upsert({
    where:  { userId: session.userId },
    update: updateData,
    create: { userId: session.userId, ...updateData },
    select: { aiSuggestionsCollapsed: true, sopPanelsCollapsed: true, darkMode: true },
  })

  const response = NextResponse.json(settings)
  if (typeof settings.aiSuggestionsCollapsed === "boolean") {
    response.cookies.set("relay_panels_collapsed", settings.aiSuggestionsCollapsed ? "1" : "0", {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    })
  }
  if (typeof settings.sopPanelsCollapsed === "boolean") {
    response.cookies.set("relay_sop_panels_collapsed", settings.sopPanelsCollapsed ? "1" : "0", {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    })
  }
  return response
}
