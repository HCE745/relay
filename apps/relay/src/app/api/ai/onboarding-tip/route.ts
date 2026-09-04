import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { callHaiku, getCached, setCache } from "@/lib/ai-haiku"

export const dynamic = "force-dynamic"

const CUTOFF_DAYS = 14

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = session.organizationId

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { createdAt: true, name: true },
  })
  if (!org) return NextResponse.json({ tip: null })

  const ageDays = (Date.now() - new Date(org.createdAt).getTime()) / 86_400_000
  if (ageDays > CUTOFF_DAYS) return NextResponse.json({ tip: null })

  const cacheKey = "onboarding-tip"
  const cached = await getCached(orgId, cacheKey)
  if (cached !== undefined) return NextResponse.json({ tip: cached })

  const [issues, users, locations, routingRules, qrCodes] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.location.count({ where: { organizationId: orgId } }),
    prisma.routingRule.count({ where: { organizationId: orgId } }),
    prisma.qrCode.count({ where: { organizationId: orgId } }),
  ])

  const gaps: string[] = []
  if (locations === 0) gaps.push("no locations added")
  if (users <= 1) gaps.push("no team members invited")
  if (issues === 0) gaps.push("no issues submitted yet")
  if (routingRules === 0) gaps.push("no routing rules configured")
  if (qrCodes === 0) gaps.push("no QR codes set up")

  if (gaps.length === 0) {
    await setCache(orgId, cacheKey, null)
    return NextResponse.json({ tip: null })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const tip = `Next step: ${gaps[0].replace(/^no\s/, "Add your first ").replace("ed yet", "")}`
    await setCache(orgId, cacheKey, tip)
    return NextResponse.json({ tip })
  }

  const prompt = `You're onboarding a new operations team to Relay, an issue-tracking platform. They've been using it ${Math.round(ageDays)} day(s).\n\nSetup gaps: ${gaps.join(", ")}\n\nWrite ONE specific, encouraging tip (under 20 words) for the most important next step. Be direct and action-oriented.`
  const text = await callHaiku(prompt, { maxTokens: 80, timeoutMs: 5000 })

  const tip = text?.trim() ?? `Next: ${gaps[0]}`
  await setCache(orgId, cacheKey, tip)
  return NextResponse.json({ tip })
}
