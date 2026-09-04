import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny
  const { computeResult } = body

  if (!computeResult) return NextResponse.json({ error: "computeResult required" }, { status: 400 })

  const fin = computeResult.financials
  const val = computeResult.valuation
  const qual = computeResult.qualFactors as { name: string; value: string; pctAdjustment: number; note: string }[]
  const drivers = computeResult.drivers as typeof qual
  const detractors = computeResult.detractors as typeof qual
  const inputs = computeResult.inputs

  const qualLines = qual.map((f) =>
    `  ${f.name}: ${f.value} → ${f.pctAdjustment >= 0 ? "+" : ""}${f.pctAdjustment}% (${f.note})`
  ).join("\n")

  const prompt = `You are a business valuation advisor for ${computeResult.entityName}.
You have been given REAL computed financial data. DO NOT invent or estimate any numbers not listed below.
Generate a structured valuation narrative with three sections:
1. VALUE DRIVERS (what's making this business more valuable — reference specific numbers)
2. VALUE DETRACTORS (what's reducing value — be specific and honest)
3. RECOMMENDATIONS (3-5 specific, actionable steps to increase value, tied to the actual weak spots)

=== COMPUTED FINANCIALS (trailing 12 months) ===
Revenue TTM: ${fmt(fin.revenueTTMCents)}
Prior year revenue: ${fmt(fin.priorRevenueCents)}
Revenue growth: ${fin.revGrowthPct.toFixed(1)}% YoY
Gross margin: ${fin.grossMarginPct.toFixed(1)}%
Net income TTM: ${fmt(fin.netIncomeTTMCents)}
EBITDA: ${fmt(fin.ebitdaCents)} (= net income + interest ${fmt(fin.interestExpenseCents)} + taxes ${fmt(fin.taxExpenseCents)} + depreciation ${fmt(fin.depreciationCents)} + amortization ${fmt(fin.amortizationCents)})
SDE: ${fmt(fin.sdeCents)} (EBITDA + owner comp ${fmt(fin.ownerCompCents)} + add-backs ${fmt(fin.addbacksCents)})
EBITDA margin: ${fin.ebitdaMarginPct.toFixed(1)}%

=== QUALITATIVE FACTORS ===
Industry: ${inputs.industry.replace(/_/g, " ")}
Owner involvement: ${inputs.ownerInvolvement}
Top customer concentration: ${inputs.customerConcentrationPct}% of revenue
Recurring revenue: ${inputs.recurringRevenuePct}%

=== QUALITATIVE ADJUSTMENTS APPLIED ===
${qualLines}
Total qualitative adjustment: ${computeResult.totalQualAdjPct >= 0 ? "+" : ""}${computeResult.totalQualAdjPct.toFixed(0)}%

=== INDICATIVE VALUATION RANGE ===
Low:  ${fmt(val.adjusted.low)}
Base: ${fmt(val.adjusted.base)}
High: ${fmt(val.adjusted.high)}
Primary method: ${val.primaryMethod.toUpperCase()} — ${val.primaryReason}

=== POSITIVE FACTORS ===
${drivers.length > 0 ? drivers.map((d) => `  ${d.name}: ${d.value} (+${d.pctAdjustment}%)`).join("\n") : "  None"}

=== NEGATIVE FACTORS ===
${detractors.length > 0 ? detractors.map((d) => `  ${d.name}: ${d.value} (${d.pctAdjustment}%)`).join("\n") : "  None"}

Write the narrative in three labeled sections:
**VALUE DRIVERS**
**VALUE DETRACTORS**
**RECOMMENDATIONS TO INCREASE VALUE**

Each recommendation must reference a specific metric from above (e.g., "reduce top-customer concentration from ${inputs.customerConcentrationPct}% toward under 25%") — no generic advice.
Keep each section to 3-5 bullet points. Use dollar amounts from above where possible.
DO NOT state any numbers not listed above. DO NOT fabricate metrics.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  })

  const narrative = response.content[0].type === "text" ? response.content[0].text : ""
  return NextResponse.json({ narrative })
}
