import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { DiscoveredCompany } from "../route"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { company } = await req.json() as { company: DiscoveredCompany }
  if (!company?.companyName) return NextResponse.json({ error: "company required" }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

  const senderName = session.name ?? "Will"
  const senderTitle = "Co-founder, Relay"

  const painPointsText = company.painPoints?.length
    ? company.painPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : "Multi-location coordination and operational issue tracking"

  const fitReasonsText = company.relayFitReasons?.length
    ? company.relayFitReasons.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "Relay's multi-location platform directly addresses their operational needs"

  const prompt = `Write a short, personalized cold outreach email from ${senderName} (${senderTitle}) to a decision-maker at ${company.companyName}.

COMPANY CONTEXT:
- Company: ${company.companyName}
- Industry: ${company.industry}
- Location: ${[company.city, company.state].filter(Boolean).join(", ") || "US"}
- Size: ${company.estimatedEmployees ? `${company.estimatedEmployees} employees` : "mid-size company"}
- What they do: ${company.summary}
- Outreach angle: ${company.suggestedOutreachAngle}

THEIR PAIN POINTS (reference 1-2 of these naturally):
${painPointsText}

WHY RELAY FITS THEM (weave 1-2 of these in):
${fitReasonsText}

RELAY OVERVIEW:
Relay is an operations platform for multi-location businesses. It gives every location a structured way to report issues, track maintenance, manage assets via QR codes, and communicate across shifts and sites — all in one dashboard. Think of it as the operational backbone for companies running multiple physical locations.

EMAIL REQUIREMENTS:
- Subject line: concise, specific to their business, not generic (no "Quick question" or "Following up")
- Body: 4-6 sentences total. Opening hook that references something specific about their operation. One sentence about a pain point they likely have. One sentence about what Relay does. One specific feature or outcome relevant to them. Clear CTA (5-minute call or demo).
- Tone: direct, professional, peer-to-peer — not salesy or "just checking in"
- Do NOT use: hollow phrases like "I hope this finds you well", "I wanted to reach out", "game-changer", "seamlessly"
- Sign off as: ${senderName} | ${senderTitle}

Return ONLY this JSON (no other text):
{"subject": "...", "body": "..."}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system: "You are an expert B2B cold email writer. Output only valid JSON.",
      messages: [
        { role: "user",      content: prompt },
        { role: "assistant", content: "{" },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[discover/email] Anthropic error", res.status, err.slice(0, 300))
    return NextResponse.json({ error: "Email generation failed" }, { status: 502 })
  }

  const data = await res.json() as { content: { type: string; text?: string }[] }
  const rawText = data.content.filter(b => b.type === "text").at(-1)?.text?.trim() ?? ""

  // Prepend the "{" we sent as prefill
  const fullJson = "{" + rawText
  try {
    const parsed = JSON.parse(fullJson) as { subject?: string; body?: string }
    const subject = parsed.subject?.trim() ?? `Operational platform for ${company.companyName}`
    const body = parsed.body?.trim() ?? ""
    return NextResponse.json({ subject, body })
  } catch {
    // Fallback: extract JSON from anywhere in the text
    const match = fullJson.match(/"subject"\s*:\s*"([^"]+)"/)
    const bodyMatch = fullJson.match(/"body"\s*:\s*"([\s\S]+?)"(?:\s*[,}])/)
    return NextResponse.json({
      subject: match?.[1] ?? `Operational platform for ${company.companyName}`,
      body: bodyMatch?.[1]?.replace(/\\n/g, "\n") ?? rawText,
    })
  }
}
