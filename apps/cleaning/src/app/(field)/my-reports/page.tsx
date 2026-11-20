import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { getOrgTimezone } from "@/lib/data/org"
import { listReports } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"
import { categoryLabel, STATUS_META, CONFIDENTIALITY_META } from "@/lib/employee-reports/labels"

export const dynamic = "force-dynamic"

// Employee-facing list of reports the signed-in person has PERSONALLY submitted,
// including confidential ones. Investigation internals stay protected — this view
// shows only status + what they filed (the data layer redacts the rest).
export default async function MyReportsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "operations.employeeReports"))) redirect("/today")

  const actor = { userId: session.userId, role: session.role as ActorRole }
  const [reports, tz] = await Promise.all([
    listReports(orgId, actor, { mine: true }),
    getOrgTimezone(orgId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <Link href="/today" className="text-sm text-slate-500">
          ← Today
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">My reports</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Reports you&apos;ve submitted and where they stand. Review details stay private to management.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">You haven&apos;t submitted any reports</p>
          <p className="mt-1 text-sm text-slate-500">Use &ldquo;Report a concern&rdquo; on a job to raise one.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const status = STATUS_META[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-600" }
            const conf = CONFIDENTIALITY_META[r.confidentiality] ?? { label: r.confidentiality, cls: "bg-slate-100 text-slate-600" }
            return (
              <li key={r.id}>
                <Link href={`/my-reports/${r.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.title || categoryLabel(r.category)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${conf.cls}`}>{conf.label}</span>
                    <span>{DateTime.fromJSDate(r.createdAt, { zone: tz }).toFormat("LLL d, yyyy")}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
