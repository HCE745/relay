import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { callHaiku } from "@/lib/ai-haiku"

export const dynamic = "force-dynamic"

interface NlFilters {
  status?:   string
  category?: string
  priority?: string
  summary:   string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query } = await req.json() as { query: string }
  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ filters: { summary: query } })
  }

  const prompt = `Convert this natural language issue search into structured filters for an issue tracking system.

Query: "${query}"

Valid statuses: OPEN, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED, PENDING_VENDOR
Valid categories: MAINTENANCE, SAFETY, EQUIPMENT_BREAKDOWN, SUPPLY_SHORTAGE, CUSTOMER_COMPLAINT, EMPLOYEE, FACILITY, INJURY, GENERAL, VEHICLE
Valid priorities: LOW, MEDIUM, HIGH, CRITICAL

Respond with JSON only: {"status":"OPEN","category":"SAFETY","priority":"HIGH","summary":"safety issues"}
Include only filters clearly implied by the query. Always include "summary" (3-5 words describing what to look for).`

  const text = await callHaiku(prompt, { maxTokens: 128, timeoutMs: 5000 })
  let filters: NlFilters = { summary: query }

  if (text) {
    try { filters = { ...filters, ...JSON.parse(text.trim()) as NlFilters } } catch { /* use default */ }
  }

  return NextResponse.json({ filters })
}
