import { requireAccountManager } from "@/lib/guards"
import { buildExport, recordExport, type ExportKind } from "@/lib/data/exports"

const CAP = "integrations.exports"
const KINDS = new Set<ExportKind>(["QBO_INVOICES", "QBO_CUSTOMERS", "XERO_INVOICES", "XERO_CONTACTS", "GUSTO_HOURS", "ADP_HOURS"])
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// Generate and download a CSV export, recording the run in history. CSV only —
// no API integration (see report). Guarded to OWNER/ADMIN/MANAGER.
export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind") as ExportKind | null
  if (!kind || !KINDS.has(kind)) return new Response(JSON.stringify({ error: "Unknown export kind" }), { status: 400, headers: { "content-type": "application/json" } })
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const opts = { periodStart: isDate(from) ? from : undefined, periodEnd: isDate(to) ? to : undefined }

  const { csv, filename, rowCount } = await buildExport(g.orgId, kind, opts)
  await recordExport(g.orgId, kind, { ...opts, rowCount, userId: g.session.userId, userName: g.session.name })

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  })
}
