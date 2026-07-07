import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { autoRouteIssue } from "@/lib/routing"
import { generateIssueSuggestions } from "@/lib/ai-suggestions"
import { matchSOPToIssue } from "@/lib/sop-matching"

// Demo-only endpoint used by the guided tour's Step 9 issue submission.
// Bypasses the UI form to avoid browser event / session propagation issues
// while still creating a real issue in the demo org with full AI processing.

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Demo session required" }, { status: 403 })
  }

  const body = await req.json() as { title?: string; description?: string }
  const title       = body.title?.trim()
  const description = body.description?.trim() ?? null

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  // Reporter profile for location / department fallbacks
  const reporter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      locationId:   true,
      departmentId: true,
    },
  })

  const resolvedLocationId   = reporter?.locationId ?? null
  const resolvedDepartmentId = reporter?.departmentId ?? null

  // AI-inferred category + priority (same as the main issues route)
  let category = "GENERAL"
  let priority  = "MEDIUM"
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 100,
          messages: [{
            role:    "user",
            content: `Classify this workplace issue. Respond ONLY with JSON:\n{"category":"EQUIPMENT_BREAKDOWN|MAINTENANCE|SAFETY|FACILITY|GENERAL","priority":"CRITICAL|HIGH|MEDIUM|LOW"}\n\nTitle: ${title}\nDescription: ${description ?? ""}`,
          }],
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json() as { content: Array<{ type: string; text: string }> }
        const text = data.content.find(c => c.type === "text")?.text ?? ""
        const parsed = JSON.parse(
          text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
        ) as { category?: string; priority?: string }
        const validCats = ["EQUIPMENT_BREAKDOWN","MAINTENANCE","SAFETY","FACILITY","GENERAL",
                           "INJURY","SUPPLY_SHORTAGE","CUSTOMER_COMPLAINT","VEHICLE","EMPLOYEE"]
        const validPris = ["CRITICAL","HIGH","MEDIUM","LOW"]
        if (parsed.category && validCats.includes(parsed.category)) category = parsed.category
        if (parsed.priority && validPris.includes(parsed.priority)) priority = parsed.priority
      }
    }
  } catch {
    // Graceful fallback — tour continues regardless
  }

  // Auto-route to find the right assignee
  const routing = await autoRouteIssue({
    organizationId: session.organizationId,
    category,
    priority,
    locationId:   resolvedLocationId,
    departmentId: resolvedDepartmentId,
    assetId:      null,
  })

  // Create the issue
  const issue = await prisma.issue.create({
    data: {
      title,
      description,
      priority,
      category,
      status:         "OPEN",
      organizationId: session.organizationId,
      reportedById:   session.userId,
      locationId:     resolvedLocationId,
      departmentId:   resolvedDepartmentId,
      assignedToId:   routing.userId,
    },
    select: { id: true },
  })

  // Kick off AI suggestions + SOP matching in the background (non-blocking)
  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { aiSuggestionsAvailable: true, industry: true },
  })

  if (org?.aiSuggestionsAvailable) {
    void generateIssueSuggestions(
      {
        id:             issue.id,
        title,
        description,
        category,
        priority,
        organizationId: session.organizationId,
      },
      org.industry ?? null
    ).catch(() => {})
  }

  void matchSOPToIssue({
    id:             issue.id,
    title,
    description,
    category,
    assetType:      null,
    departmentId:   resolvedDepartmentId,
    organizationId: session.organizationId,
  }).catch(() => {})

  return NextResponse.json({ issueId: issue.id })
}
