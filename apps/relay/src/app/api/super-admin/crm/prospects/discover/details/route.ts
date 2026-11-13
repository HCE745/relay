import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "../route"
import Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { company } = await req.json() as { company: DiscoveredCompanyBasic }
    if (!company?.companyName) return NextResponse.json({ error: "company required" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

    const location = [company.city, company.state, company.country].filter(Boolean).join(", ")

    const prompt = `You are a B2B sales researcher. Generate targeted sales research for Relay — operational coordination software for manufacturing facilities (issue reporting and routing, maintenance request management, work order assignment, digital shift handoffs, QR-code asset tracking, real-time shop floor visibility).

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
- painPoints: specific manufacturing operational challenges (maintenance tracking gaps, shift handoff breakdowns, equipment issue reporting delays, work order visibility, floor-level coordination)
- relayFitReasons: name the specific Relay capability (e.g. "QR-code asset tagging", "work order assignment queue", "digital shift handoff checklists", "real-time issue routing")
- suggestedOutreachAngle: reference their specific manufacturing subsector or a recognizable operational bottleneck they face`

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model:      "claude-haiku-5-5",
      max_tokens: 600,
      system:     "You are a B2B sales researcher. Output only valid JSON. No markdown. No explanation.",
      messages:   [{ role: "user", content: prompt }],
    })

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .at(-1)?.text?.trim() ?? ""

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
      // Regex fallback for slightly malformed JSON
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
