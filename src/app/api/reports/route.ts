import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getPL, getBalanceSheet, getTrialBalance, getARAgingReport, getAPAgingReport, toCsv, centsToDisplay } from "@/lib/reports"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") ?? "pl"
  const entityId = searchParams.get("entityId") ?? ""
  const from = searchParams.get("from") ?? `${new Date().getFullYear()}-01-01`
  const to = searchParams.get("to") ?? `${new Date().getFullYear()}-12-31`
  const format = searchParams.get("format") ?? "json"
  const consolidated = searchParams.get("consolidated") === "true"

  const period = { start: new Date(from), end: new Date(to) }
  const { tenantId } = session

  let data: unknown
  if (type === "pl") data = await getPL(tenantId, entityId, period, { consolidated })
  else if (type === "bs") data = await getBalanceSheet(tenantId, entityId, period.end, { consolidated })
  else if (type === "tb") data = await getTrialBalance(tenantId, entityId, period)
  else if (type === "ar_aging") data = await getARAgingReport(tenantId, entityId, period.end)
  else if (type === "ap_aging") data = await getAPAgingReport(tenantId, entityId, period.end)

  if (format === "csv") {
    const rows = Array.isArray(data)
      ? data as Record<string, unknown>[]
      : [data as Record<string, unknown>]
    const csv = toCsv(rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? centsToDisplay(v) : v])
      )
    ))
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${type}.csv"` },
    })
  }

  return NextResponse.json(data)
}
