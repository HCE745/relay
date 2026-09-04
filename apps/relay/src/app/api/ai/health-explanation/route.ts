import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { callHaiku, getCached, setCache } from "@/lib/ai-haiku"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId, healthScore, loginPts, issuePts, userPts, routingPts, subPts } =
    await req.json() as {
      orgId: string; healthScore: number
      loginPts: number; issuePts: number; userPts: number; routingPts: number; subPts: number
    }

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const cacheKey = "health-explanation"
  const cached = await getCached(orgId, cacheKey)
  if (cached !== undefined) return NextResponse.json({ explanation: cached })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ explanation: "API key not configured." })
  }

  const total = loginPts + issuePts + userPts + routingPts + subPts
  const factors = [
    `login activity: ${loginPts}/25`,
    `issues submitted: ${issuePts}/25`,
    `team members: ${userPts}/20`,
    `routing rules: ${routingPts}/15`,
    `subscription: ${subPts}/15`,
  ].join(", ")

  const prompt = `Explain this customer health score in one plain-English sentence (under 25 words).\n\nHealth score: ${healthScore}/100 (raw: ${total})\nComponent scores — ${factors}\n\nFocus on the biggest gap(s). Be objective and factual.`
  const text = await callHaiku(prompt, { maxTokens: 80, timeoutMs: 5000 })

  const explanation = text?.trim() ?? `Score ${healthScore}/100 based on login activity, issue volume, team size, routing config, and subscription status.`
  await setCache(orgId, cacheKey, explanation)
  return NextResponse.json({ explanation })
}
