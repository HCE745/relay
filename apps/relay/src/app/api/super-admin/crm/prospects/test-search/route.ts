import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export const maxDuration = 120

/**
 * GET /api/super-admin/crm/prospects/test-search
 *
 * Diagnostic endpoint — runs two hardcoded searches and returns the raw
 * Anthropic API responses with no parsing so we can see exactly what the
 * model returns in each approach.
 *
 * Approach A: with web_search_20250305 tool (what the current route uses)
 * Approach B: knowledge-based, no tools, assistant prefill for JSON
 */
export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

  const HARDCODED_QUERY = "warehousing companies in Indiana with 50-200 employees"
  const BASE_HEADERS = {
    "x-api-key":         apiKey,
    "anthropic-version": "2023-06-01",
    "content-type":      "application/json",
  }

  // ── Approach A: web search tool ──────────────────────────────────────────────
  let approachA: { status: number; parsed: unknown; textBlocks: string[]; stopReason: string; error?: string }
  try {
    const resA = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: { ...BASE_HEADERS, "anthropic-beta": "web-search-2025-03-05" },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 2000,
        system:     "You must respond with ONLY a valid JSON array. No markdown. No explanation.",
        messages: [
          { role: "user", content: `Find 3 real ${HARDCODED_QUERY}. Return a JSON array where each object has: companyName, website, city, state.` },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const rawA   = await resA.text()
    const parsed = JSON.parse(rawA) as { content?: { type: string; text?: string }[]; stop_reason?: string }
    const textBlocks = (parsed.content ?? [])
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map(b => b.text)
    approachA = {
      status:     resA.status,
      parsed,
      textBlocks,
      stopReason: parsed.stop_reason ?? "unknown",
    }
  } catch (err) {
    approachA = { status: 0, parsed: null, textBlocks: [], stopReason: "error", error: String(err) }
  }

  // ── Approach B: no tools, assistant prefill ───────────────────────────────────
  let approachB: { status: number; parsed: unknown; textBlocks: string[]; stopReason: string; companiesParsed: number; error?: string }
  try {
    const resB = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 3000,
        system:     `You must respond with ONLY a valid JSON array. No markdown. No tables. No headers. No explanation. No code blocks. Just a raw JSON array starting with [ and ending with ]. Each element must be a JSON object with these exact keys: companyName, website, city, state, industry, estimatedEmployees, summary, painPoints (array of 3 strings), relayFitReasons (array of 3 strings), suggestedOutreachAngle, fitScore (integer 0-100). Do not return anything other than the JSON array.`,
        messages: [
          { role: "user", content: `Based on your training knowledge, list 3 to 5 real ${HARDCODED_QUERY} that would be good prospects for Relay, an operations platform for multi-location businesses. Use companies from your training data. Your entire response must be only the JSON array — nothing before [, nothing after ].` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const rawB   = await resB.text()
    const parsed = JSON.parse(rawB) as { content?: { type: string; text?: string }[]; stop_reason?: string }
    const textBlocks = (parsed.content ?? [])
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map(b => b.text)

    // Try to parse the JSON array directly (no prefill, model outputs full array)
    let companiesParsed = 0
    for (const t of textBlocks) {
      try {
        const arr = JSON.parse(t)
        if (Array.isArray(arr)) { companiesParsed = arr.length; break }
      } catch { /* try next */ }
    }

    approachB = {
      status:     resB.status,
      parsed,
      textBlocks,
      stopReason: parsed.stop_reason ?? "unknown",
      companiesParsed,
    }
  } catch (err) {
    approachB = { status: 0, parsed: null, textBlocks: [], stopReason: "error", companiesParsed: 0, error: String(err) }
  }

  return NextResponse.json({
    query: HARDCODED_QUERY,
    approachA: {
      description:        "web_search_20250305 tool (current route approach)",
      httpStatus:         approachA.status,
      stopReason:         approachA.stopReason,
      contentBlockTypes:  Array.isArray((approachA.parsed as { content?: unknown[] })?.content)
        ? (approachA.parsed as { content: { type: string }[] }).content.map(b => b.type)
        : [],
      textBlockCount:     approachA.textBlocks.length,
      firstTextBlock:     approachA.textBlocks[0]?.slice(0, 500) ?? null,
      error:              approachA.error ?? null,
    },
    approachB: {
      description:        "Knowledge-based, no tools, assistant prefill",
      httpStatus:         approachB.status,
      stopReason:         approachB.stopReason,
      contentBlockTypes:  Array.isArray((approachB.parsed as { content?: unknown[] })?.content)
        ? (approachB.parsed as { content: { type: string }[] }).content.map(b => b.type)
        : [],
      textBlockCount:     approachB.textBlocks.length,
      companiesParsed:    approachB.companiesParsed,
      firstTextBlock:     approachB.textBlocks[0]?.slice(0, 800) ?? null,
      error:              approachB.error ?? null,
    },
  })
}
