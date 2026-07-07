import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { generateLiveSuggestion } from "@/lib/ai-suggestions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Policy check
  const [org, userSettings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true, industry: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { aiSuggestionsOn: true },
    }),
  ])

  if (!org?.aiSuggestionsAvailable) {
    return NextResponse.json({ blocked: true, aiTip: null })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[AI Suggestion] ANTHROPIC_API_KEY is not configured — suggestions disabled")
    return NextResponse.json({ blocked: true, aiTip: null })
  }

  const policy = org?.aiSuggestionsPolicy ?? "user_choice"
  if (policy === "off_all") {
    return NextResponse.json({ blocked: true, aiTip: null })
  }
  if (policy === "user_choice" && !(userSettings?.aiSuggestionsOn ?? true)) {
    return NextResponse.json({ blocked: true, aiTip: null })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") ?? "GENERAL"
  const title = searchParams.get("title") ?? ""
  const description = searchParams.get("description") ?? ""

  // Need at least a title to generate something meaningful
  if (!title.trim() && !description.trim()) {
    return NextResponse.json({ aiTip: null })
  }

  console.log("[AI Suggestion] Calling generateLiveSuggestion — category:", category, "title:", title.slice(0, 60))
  const aiTip = await generateLiveSuggestion(
    title,
    description,
    category,
    session.organizationId,
    org?.industry ?? null
  )

  if (aiTip) {
    console.log("[AI Suggestion] Live suggestion generated OK, length:", aiTip.length)
  } else {
    console.error("[AI Suggestion] generateLiveSuggestion returned null — category:", category, "org:", session.organizationId)
  }

  return NextResponse.json({ aiTip })
}
