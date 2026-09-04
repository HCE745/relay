import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const SEVERITY_LABEL: Record<string, string> = {
  MINOR:    "minor / first aid",
  MODERATE: "moderate",
  SEVERE:   "severe / emergency",
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [org, userSettings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { aiSuggestionsOn: true },
    }),
  ])

  if (!org?.aiSuggestionsAvailable || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ blocked: true, guidance: null })
  }

  const policy = org.aiSuggestionsPolicy ?? "user_choice"
  if (policy === "off_all" || (policy === "user_choice" && !(userSettings?.aiSuggestionsOn ?? true))) {
    return NextResponse.json({ blocked: true, guidance: null })
  }

  const { searchParams } = req.nextUrl
  const severity    = searchParams.get("severity") ?? "MINOR"
  const description = searchParams.get("description") ?? ""

  if (!description.trim()) {
    return NextResponse.json({ guidance: null })
  }

  const severityLabel = SEVERITY_LABEL[severity] ?? "minor"
  const isEmergency   = severity === "SEVERE"

  const prompt = `You are a workplace safety assistant providing immediate first aid guidance. An employee has reported a ${severityLabel} workplace injury.

Injury description: "${description.slice(0, 500)}"

Provide ${isEmergency ? "5-6" : "3-4"} concise, numbered first aid steps appropriate for this specific injury and severity. Be direct and actionable. ${isEmergency ? "Start with calling emergency services." : "Focus on immediate care."}

Do NOT include any preamble, headers, or closing remarks — just the numbered steps.`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return NextResponse.json({ guidance: null })

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim() ?? null

    return NextResponse.json({ guidance: text })
  } catch {
    return NextResponse.json({ guidance: null })
  }
}
