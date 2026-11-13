import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { DiscoveredCompany } from "../route"
import Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { company } = await req.json() as { company: DiscoveredCompany }
    if (!company?.companyName) return NextResponse.json({ error: "company required" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

    const senderName  = session.name ?? "Will"
    const location    = [company.city, company.state].filter(Boolean).join(", ") || "the US"
    const employees   = company.estimatedEmployees ? `${company.estimatedEmployees} employees` : "a mid-size team"
    const painPt      = company.painPoints?.[0] ?? "coordinating operations across the facility"
    const fitReason   = company.relayFitReasons?.[0] ?? "Relay streamlines manufacturing operations"
    const angle       = company.suggestedOutreachAngle ?? ""

    const prompt = `Write a short B2B cold outreach email from ${senderName} at Relay to a decision-maker at ${company.companyName} (${company.industry || "manufacturing"} company, ${location}, ${employees}).

Key context:
- Their pain: ${painPt}
- Why Relay fits: ${fitReason}
- Angle: ${angle}
- What Relay does: operational coordination software for manufacturing facilities — issue reporting and routing, maintenance request management, QR-code asset tracking, digital shift handoffs.

Rules:
- Subject: specific to their business (not "Quick question" or "Following up")
- Body: 4-5 sentences. Hook referencing their specific operation → one pain point → what Relay does → specific feature → clear CTA (5-min call or demo)
- Tone: peer-to-peer, direct. No "I hope this finds you well", no "game-changer"
- Sign off: ${senderName} | Co-founder, Relay

Return ONLY valid JSON: {"subject": "...", "body": "..."}`

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model:      "claude-haiku-5-5",
      max_tokens: 800,
      system:     "You are a B2B cold email writer. Output only valid JSON with keys 'subject' and 'body'. No markdown. No explanation.",
      messages:   [{ role: "user", content: prompt }],
    })

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .at(-1)?.text?.trim() ?? ""

    try {
      const parsed = JSON.parse(rawText) as { subject?: string; body?: string }
      return NextResponse.json({
        subject: parsed.subject?.trim() ?? `Operational visibility for ${company.companyName}`,
        body:    parsed.body?.trim()    ?? "",
      })
    } catch {
      const subMatch  = rawText.match(/"subject"\s*:\s*"([^"]*)"/)
      const bodyMatch = rawText.match(/"body"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/)
      return NextResponse.json({
        subject: subMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') ?? `Operational visibility for ${company.companyName}`,
        body:    bodyMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') ?? rawText,
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[discover/email] unhandled error:", msg, err instanceof Error ? err.stack : "")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
