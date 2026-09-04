import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100)
}
function fmtPct(n: number | null): string {
  if (n == null) return "N/A"
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}

function buildMonthlyPrompt(d: Record<string, unknown>): string {
  const pl = d.pl as { totalRevenue: number; grossProfit: number; totalExpenses: number; netIncome: number; totalCogs: number }
  const ytd = d.plYTD as typeof pl
  const kpis = d.kpis as { grossMarginPct: number | null; netMarginPct: number | null; currentRatio: number | null; cashRunwayMonths: number | null; revGrowthPct: number | null }
  const period = d.period as { label: string }
  const entity = d.entity as { name: string }
  const anomalies = d.anomalies as { severity: string; reason: string }[]
  const bv = d.budgetVariances as { accountName: string; varianceCents: number; variancePct: number | null }[]

  const top3Variances = (bv ?? [])
    .slice(0, 3)
    .map((v) => `  ${v.accountName}: actual vs budget ${v.varianceCents >= 0 ? "+" : ""}${fmt(v.varianceCents)} (${v.variancePct != null ? `${v.variancePct >= 0 ? "+" : ""}${v.variancePct.toFixed(1)}%` : "no budget"})`)
    .join("\n") || "  No budget data"

  return `You are writing an executive summary for the monthly financial report of ${entity.name} for ${period.label}.
Use ONLY the figures below. DO NOT invent or estimate any number not shown.
Write a concise 3-paragraph executive summary covering: (1) overall performance, (2) key variances or trends, (3) outlook / watchpoints.
Be specific — reference the exact dollar amounts and percentages shown.

=== ${period.label} FINANCIALS ===
Revenue: ${fmt(pl.totalRevenue)}
Gross Profit: ${fmt(pl.grossProfit)} (margin: ${fmtPct(kpis.grossMarginPct)})
Operating Expenses: ${fmt(pl.totalExpenses)}
Net Income: ${fmt(pl.netIncome)} (margin: ${fmtPct(kpis.netMarginPct)})
Month-over-month revenue growth: ${fmtPct(kpis.revGrowthPct)}

YTD Revenue: ${fmt(ytd.totalRevenue)}
YTD Net Income: ${fmt(ytd.netIncome)}

Cash Position: ${fmt((d.cashPositionCents as number) ?? 0)}
Cash Runway: ${kpis.cashRunwayMonths != null ? `${kpis.cashRunwayMonths.toFixed(1)} months` : "N/A"}
Current Ratio: ${kpis.currentRatio != null ? kpis.currentRatio.toFixed(2) : "N/A"}

=== BUDGET vs ACTUAL (top variances) ===
${top3Variances}

=== ANOMALIES FLAGGED THIS MONTH ===
${anomalies.length > 0 ? anomalies.map((a) => `  [${a.severity}] ${a.reason}`).join("\n") : "  None"}

Write in professional, clear financial language. 3 paragraphs, no headers. Reference specific numbers.`
}

function buildTaxPrompt(d: Record<string, unknown>): string {
  const pl = d.pl as { totalRevenue: number; grossProfit: number; totalExpenses: number; netIncome: number; totalCogs: number }
  const entity = d.entity as { name: string }
  const fy = d.fiscalYear as number
  const fas = d.fixedAssets as { name: string; depreciationYearCents: number }[]
  const totalDepr = d.totalFixedAssetDeprYear as number
  const vendors = d.vendorPayments as { vendorName: string; totalPaidCents: number; note1099: string }[]

  const top1099 = vendors.filter((v) => v.note1099).slice(0, 5)
    .map((v) => `  ${v.vendorName}: ${fmt(v.totalPaidCents)} — ${v.note1099}`)
    .join("\n") || "  None identified"

  return `You are writing a summary memo for a CPA tax packet for ${entity.name}, fiscal year ${fy}.
Use ONLY the figures below. This is a CPA-prep summary, not tax advice.
Write a 2-paragraph overview: (1) income summary and key P&L items, (2) fixed assets / depreciation highlights and 1099 vendor items to review.

=== FY${fy} FINANCIALS ===
Revenue: ${fmt(pl.totalRevenue)}
COGS: ${fmt(pl.totalCogs)}
Gross Profit: ${fmt(pl.grossProfit)}
Operating Expenses: ${fmt(pl.totalExpenses)}
Net Income: ${fmt(pl.netIncome)}

=== FIXED ASSETS ===
Total assets on register: ${fas.length}
Total depreciation posted FY${fy}: ${fmt(totalDepr)}

=== 1099 CANDIDATES ===
${top1099}

Note for CPA: verify all figures against source documents. Tax treatment of depreciation (Section 179, bonus depreciation) deferred to tax professional.`
}

function buildInvestorPrompt(d: Record<string, unknown>): string {
  const entity = d.entity as { name: string }
  const ttm = d.plTTM as { totalRevenue: number; grossProfit: number; totalExpenses: number; netIncome: number }
  const hist = d.historicalPL as { year: number; pl: { totalRevenue: number; netIncome: number } }[]
  const gm = d.grossMarginPct as number | null
  const nm = d.netMarginPct as number | null
  const rg = d.revenueGrowthPct as number | null
  const runway = d.runwayMonths as number | null
  const cash = d.cashPositionCents as number
  const burn = d.monthlyBurnCents as number
  const valLow  = d.valuationLow as number
  const valHigh = d.valuationHigh as number

  const histLines = hist.map((h) => `  ${h.year}: Revenue ${fmt(h.pl.totalRevenue)}, Net Income ${fmt(h.pl.netIncome)}`).join("\n")

  return `You are writing an executive summary for an investor/lender presentation for ${entity.name}.
Use ONLY the figures below. DO NOT invent metrics.
Write a 3-paragraph summary: (1) business financial overview and growth, (2) margins, liquidity, operational efficiency, (3) capital position and investment context.

=== TRAILING 12 MONTHS ===
Revenue: ${fmt(ttm.totalRevenue)}
Gross Profit: ${fmt(ttm.grossProfit)} (${fmtPct(gm)} margin)
Net Income: ${fmt(ttm.netIncome)} (${fmtPct(nm)} margin)
Revenue growth (YoY): ${fmtPct(rg)}

=== HISTORICAL REVENUE & NET INCOME ===
${histLines}

=== LIQUIDITY ===
Cash: ${fmt(cash)}
Monthly Burn: ${fmt(burn)}
Runway: ${runway != null ? `${runway.toFixed(1)} months` : "N/A"}

=== INDICATIVE VALUATION ===
Revenue-multiple range: ${fmt(valLow)} – ${fmt(valHigh)} (indicative only; use Valuation module for full analysis)

Write in professional investor-facing language. Reference specific numbers. Acknowledge this is historical performance only.`
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny
  const { type, packetData } = body as { type: string; packetData: Record<string, unknown> }

  if (!type || !packetData) return NextResponse.json({ error: "type and packetData required" }, { status: 400 })

  let prompt: string
  if (type === "monthly")       prompt = buildMonthlyPrompt(packetData)
  else if (type === "tax")      prompt = buildTaxPrompt(packetData)
  else if (type === "investor") prompt = buildInvestorPrompt(packetData)
  else return NextResponse.json({ error: "Unknown packet type" }, { status: 400 })

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  })

  const narrative = response.content[0].type === "text" ? response.content[0].text : ""
  return NextResponse.json({ narrative })
}
