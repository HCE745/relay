import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { DiscoveredCompany } from "../route"

// Email generation uses claude-sonnet-5 without web search but claude is slow —
// extend Vercel's default 10 s timeout so the function doesn't 502.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { company } = await req.json() as { company: DiscoveredCompany }
    if (!company?.companyName) return NextResponse.json({ error: "company required" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

    const senderName  = session.name ?? "Will"
    const location    = [company.city, company.state].filter(Boolean).join(", ") || "the US"
    const employees   = company.estimatedEmployees ? `${company.estimatedEmployees} employees` : "a mid-size team"
    const painPt      = company.painPoints?.[0] ?? "coordinating operations across multiple locations"
    const fitReason   = company.relayFitReasons?.[0] ?? "Relay streamlines multi-location operations"
    const angle       = company.suggestedOutreachAngle ?? ""

    // Focused, short prompt — no web search needed, research is already done
    const prompt = `Write a short B2B cold outreach email from ${senderName} at Relay to a decision-maker at ${company.companyName} (${company.industry || "operations"} company, ${location}, ${employees}).

Key context:
- Their pain: ${painPt}
- Why Relay fits: ${fitReason}
- Angle: ${angle}
- What Relay does: operations platform for multi-location businesses — issue tracking, maintenance routing, QR-code asset management, cross-site team communication.

Rules:
- Subject: specific to their business (not "Quick question" or "Following up")
- Body: 4-5 sentences. Hook referencing their specific operation → one pain point → what Relay does → specific feature → clear CTA (5-min call or demo)
- Tone: peer-to-peer, direct. No "I hope this finds you well", no "game-changer"
- Sign off: ${senderName} | Co-founder, Relay

Return ONLY valid JSON: {"subject": "...", "body": "..."}`

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 800,
        system:     "You are a B2B cold email writer. Output only valid JSON with keys 'subject' and 'body'. No markdown. No explanation.",
        messages: [
          { role: "user",      content: prompt },
          { role: "assistant", content: "{" },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[discover/email] Anthropic error", res.status, err.slice(0, 300))
      return NextResponse.json({ error: `Email generation failed (${res.status})` }, { status: 502 })
    }

    const data = await res.json() as { content: { type: string; text?: string }[] }
    const rawText = data.content.filter(b => b.type === "text").at(-1)?.text?.trim() ?? ""
    const fullJson = "{" + rawText

    try {
      const parsed = JSON.parse(fullJson) as { subject?: string; body?: string }
      return NextResponse.json({
        subject: parsed.subject?.trim() ?? `Operational visibility for ${company.companyName}`,
        body:    parsed.body?.trim()    ?? "",
      })
    } catch {
      // Regex fallback if JSON is slightly malformed (no /s flag for older TS targets)
      const subMatch  = fullJson.match(/"subject"\s*:\s*"([^"]*)"/)
      const bodyMatch = fullJson.match(/"body"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/)
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
