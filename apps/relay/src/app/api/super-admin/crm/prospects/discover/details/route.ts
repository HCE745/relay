import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "../route"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { company } = await req.json() as { company: DiscoveredCompanyBasic }
    if (!company?.companyName) return NextResponse.json({ error: "company required" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

    const location = [company.city, company.state, company.country].filter(Boolean).join(", ")

    const prompt = `You are a B2B sales researcher. Generate targeted sales research for Relay (operations platform for multi-location businesses: issue tracking, maintenance routing, QR-code asset management, facility checklists, cross-site communications).

Company: ${company.companyName}
Industry: ${company.industry || "unknown"}
Location: ${location}
Size: ${company.estimatedEmployees ? `~${company.estimatedEmployees} employees` : "unknown"}
What they do: ${company.summary}

Return ONLY valid JSON with exactly these keys:
{
  "painPoints": ["<specific operational pain 1>", "<specific operational pain 2>", "<specific operational pain 3>"],
  "relayFitReasons": ["<Relay feature that solves pain 1>", "<Relay feature that solves pain 2>", "<Relay feature that solves pain 3>"],
  "suggestedOutreachAngle": "<one sentence: the best hook for opening this conversation>"
}

Rules:
- painPoints: specific multi-location challenges (coordination gaps, maintenance blindspots, asset tracking, shift handoffs, cross-site reporting)
- relayFitReasons: name the specific Relay capability (e.g. "QR-code asset tagging", "cross-location issue queue", "facility checklist templates")
- suggestedOutreachAngle: reference their specific industry or a recognizable operational bottleneck they face`

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 600,
        system:     "You are a B2B sales researcher. Output only valid JSON. No markdown. No explanation.",
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[discover/details] Anthropic error", res.status, err.slice(0, 300))
      return NextResponse.json({ error: `Details generation failed (${res.status})` }, { status: 502 })
    }

    const data = await res.json() as { content: { type: string; text?: string }[] }
    const rawText = data.content.filter(b => b.type === "text").at(-1)?.text?.trim() ?? ""

    try {
      const p = JSON.parse(rawText) as { painPoints?: unknown; relayFitReasons?: unknown; suggestedOutreachAngle?: unknown }
      const details: DiscoveredCompanyDetails = {
        ...company,
        painPoints:             Array.isArray(p.painPoints)      ? (p.painPoints as string[])      : [],
        relayFitReasons:        Array.isArray(p.relayFitReasons) ? (p.relayFitReasons as string[]) : [],
        suggestedOutreachAngle: typeof p.suggestedOutreachAngle === "string" ? p.suggestedOutreachAngle : "",
      }
      return NextResponse.json(details)
    } catch {
      // Regex fallback
      const ptsMatch = rawText.match(/"painPoints"\s*:\s*\[([\s\S]*?)\]/)
      const rfrMatch = rawText.match(/"relayFitReasons"\s*:\s*\[([\s\S]*?)\]/)
      const angMatch = rawText.match(/"suggestedOutreachAngle"\s*:\s*"([^"]*)"/)
      const details: DiscoveredCompanyDetails = {
        ...company,
        painPoints:             ptsMatch ? (() => { try { return JSON.parse(`[${ptsMatch[1]}]`) as string[] } catch { return [] } })() : [],
        relayFitReasons:        rfrMatch ? (() => { try { return JSON.parse(`[${rfrMatch[1]}]`) as string[] } catch { return [] } })() : [],
        suggestedOutreachAngle: angMatch?.[1] ?? "",
      }
      return NextResponse.json(details)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[discover/details] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
