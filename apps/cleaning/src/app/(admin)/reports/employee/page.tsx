import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canAccessAdminRoute } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listReports } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"
import { categoryLabel, CONFIDENTIALITY_META, STATUS_META } from "@/lib/employee-reports/labels"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"

export const dynamic = "force-dynamic"

function Badge({ meta }: { meta: { label: string; cls: string } }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
}

export default async function EmployeeReportsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canAccessAdminRoute(session.role, "employee-reports")) redirect("/dashboard")
  const hasCap = await orgHasCapability(session.organizationId, "operations.employeeReports")

  const actor = { userId: session.userId, role: session.role as ActorRole }
  const reports = hasCap ? await listReports(session.organizationId, actor) : []
  const open = reports.filter((r) => r.status !== "RESOLVED").length

  return (
    <div className="space-y-6">
      <PageHeader title="Workplace reports" subtitle="Employee-filed work-quality, operational, and confidential concerns" />

      {!hasCap ? (
        <Card className="p-6">
          <p className="text-sm text-slate-600">Workplace reporting is part of the Essentials plan.</p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {reports.length} report{reports.length === 1 ? "" : "s"} you can review · {open} open.
              {session.role === "SUPERVISOR" ? " Confidential reports are routed to owners/admins." : null}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Reports are allegations until reviewed. A report never counts against an employee unless it is investigated and substantiated.
            </p>
          </Card>

          {reports.length === 0 ? (
            <EmptyState title="No reports to review" />
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/reports/employee/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{categoryLabel(r.category)}</span>
                      <Badge meta={CONFIDENTIALITY_META[r.confidentiality] ?? CONFIDENTIALITY_META.NORMAL} />
                      <Badge meta={STATUS_META[r.status] ?? STATUS_META.SUBMITTED} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {r.about?.name ? <>About {r.about.name} · </> : null}
                      Filed by {r.reportedBy?.name ?? "unknown"}
                      {r.reviewer?.name ? <> · Reviewer {r.reviewer.name}</> : null}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{DateTime.fromJSDate(r.createdAt).toFormat("LLL d")}</span>
                </Link>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
