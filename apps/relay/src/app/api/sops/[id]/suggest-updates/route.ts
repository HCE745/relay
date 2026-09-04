import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { callHaiku, getCached, setCache } from "@/lib/ai-haiku"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: sopId } = await params
  const orgId = session.organizationId

  const sop = await prisma.sOP.findUnique({
    where: { id: sopId, organizationId: orgId },
    select: {
      title:       true,
      description: true,
      category:    true,
      updatedAt:   true,
      issues: { select: { title: true, description: true }, take: 5, orderBy: { createdAt: "desc" } },
    },
  })
  if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cacheKey = `sop-updates:${sopId}`
  const cached = await getCached(orgId, cacheKey)
  if (cached !== undefined) return NextResponse.json({ suggestions: cached })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: ["ANTHROPIC_API_KEY not configured"] })
  }

  const issueContext = sop.issues.length > 0
    ? `\nRecent linked issues:\n${sop.issues.map((i: { title: string }) => `- "${i.title}"`).join("\n")}`
    : ""

  const prompt = `You are an operations expert reviewing an outdated SOP document.\n\nSOP: "${sop.title}"\nDescription: "${sop.description ?? "none"}"\nCategory: ${sop.category ?? "general"}\nLast updated: over 90 days ago${issueContext}\n\nProvide exactly 2-3 specific, actionable improvement suggestions for this SOP. Return as JSON array of strings (each under 25 words). Nothing else.`

  const text = await callHaiku(prompt, { maxTokens: 256, timeoutMs: 8000 })
  let suggestions: string[] = ["Consider reviewing procedures for accuracy", "Update contact information and escalation paths", "Verify compliance with current regulations"]

  if (text) {
    try { suggestions = JSON.parse(text.trim()) as string[] } catch { /* use defaults */ }
  }

  await setCache(orgId, cacheKey, suggestions)
  return NextResponse.json({ suggestions })
}
