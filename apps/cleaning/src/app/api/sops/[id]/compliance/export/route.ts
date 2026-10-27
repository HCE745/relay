import { requireOperations } from "@/lib/guards"
import { complianceForSop } from "@/lib/data/sops"

const CAP = "operations.sopLibrary"
const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// Per-SOP acknowledgment compliance CSV — the artifact handed to a client in a
// bid or an insurer after an incident. SUPERVISOR+ (requireOperations).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  const c = await complianceForSop(g.orgId, id)
  const headers = ["SOP", "Published Version", "Person", "Role", "Status", "Acknowledged Version", "Acknowledged At"]
  const rows = c.rows.map((r) => [c.sop.title, c.publishedVersion ?? "", r.name, r.role, r.status, r.acknowledgedVersion ?? "", r.acknowledgedAt ? new Date(r.acknowledgedAt).toISOString() : ""])
  const csv = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n")
  const safe = c.sop.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()
  return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="sop_compliance_${safe}.csv"`, "cache-control": "no-store" } })
}
