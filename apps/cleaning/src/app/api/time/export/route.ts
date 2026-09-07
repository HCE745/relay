import { DateTime } from "luxon"
import { requireAccountManager } from "@/lib/guards"
import { badRequest } from "@/lib/api"
import { listApprovedForExport } from "@/lib/data/time-entries"
import { getOrgTimezone } from "@/lib/data/org"

const CAP = "workforce.payrollExport"

// CSV of APPROVED time entries (tenant-scoped). Payroll-integration prep, NOT
// payroll: raw labor data only — no rates, tax, overtime, or deductions.
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response

  const url = new URL(request.url)
  const now = new Date()
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const start = from ? new Date(from) : new Date(now.getTime() - 30 * 86_400_000)
  const end = to ? new Date(to) : now
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return badRequest("Invalid date range")

  const orgTz = await getOrgTimezone(g.orgId)
  const entries = await listApprovedForExport(g.orgId, start, end)

  const header = [
    "Employee ID",
    "Employee Name",
    "Date",
    "Customer",
    "Site",
    "Job ID",
    "Clock In",
    "Clock Out",
    "Hours",
  ]
  const rows = entries.map((e) => {
    const tz = e.job?.serviceLocation?.timezone ?? orgTz
    const inDt = DateTime.fromJSDate(e.clockInAt, { zone: tz })
    const outDt = e.clockOutAt ? DateTime.fromJSDate(e.clockOutAt, { zone: tz }) : null
    const hours = outDt ? (outDt.toMillis() - inDt.toMillis()) / 3_600_000 : 0
    return [
      e.user.id,
      e.user.name,
      inDt.toFormat("yyyy-MM-dd"),
      e.job?.serviceLocation?.customer?.name ?? "",
      e.job?.serviceLocation?.name ?? "",
      e.job?.id ?? "",
      inDt.toFormat("yyyy-MM-dd HH:mm"),
      outDt ? outDt.toFormat("yyyy-MM-dd HH:mm") : "",
      hours.toFixed(2),
    ]
  })

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="approved-time-${inFmt(start)}-to-${inFmt(end)}.csv"`,
    },
  })
}

function inFmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}
