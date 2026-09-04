import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { detectSuggestionCategory, routeSuggestion, SUGGESTION_CATEGORY_LABEL } from "@/lib/suggestion-routing"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ category: null, routedTo: null })

  const category = detectSuggestionCategory(content)
  const routed = await routeSuggestion(session.organizationId, category, session.userId)

  return NextResponse.json({
    category,
    categoryLabel: SUGGESTION_CATEGORY_LABEL[category],
    routedTo: routed,
  })
}
