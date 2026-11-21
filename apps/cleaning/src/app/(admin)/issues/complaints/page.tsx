import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getOrgTimezone } from "@/lib/data/org"
import { listComplaints } from "@/lib/data/complaints"
import { OUTCOME_LABELS } from "@/lib/complaints/investigation"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
}
const OUTCOME_STYLE: Record<string, string> = {
  SUBSTANTIATED: "bg-red-600 text-white",
  UNSUBSTANTIATED: "bg-emerald-600 text-white",
  INCONCLUSIVE: "bg-slate-500 text-white",
}

// Customer complaints — a filtered view over the existing Issue store (source =
// CUSTOMER), with investigation status. Lives under the `issues` route key, so it
// reuses the existing access control + capability (operations.issues).
export default async function ComplaintsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "operations.issues"))) redirect("/dashboard")

  const [complaints, tz] = await Promise.all([listComplaints(orgId), getOrgTimezone(orgId)])
  const open = complaints.filter((c) => c.status === "OPEN" || c.status === "ACKNOWLEDGED").length

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title="Customer complaints" subtitle={`${open} open · ${complaints.length} total`} />
        <Link href="/issues" className="text-sm text-slate-500 hover:text-brand">All issues →</Link>
      </div>

      {complaints.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No customer complaints yet.</Card>
      ) : (
        <ul className="space-y-2">
          {complaints.map((c) => (
            <li key={c.id}>
              <Link href={`/issues/${c.id}`} className="block">
                <Card className="p-4 transition hover:border-brand/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{c.title || "Customer complaint"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {c.serviceLocation ? `${c.serviceLocation.customer.name} · ${c.serviceLocation.name}` : "—"}
                        {c.job ? ` · ${c.job.title}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                      {c.outcome ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${OUTCOME_STYLE[c.outcome]}`}>{OUTCOME_LABELS[c.outcome]}</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Allegation</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{DateTime.fromJSDate(c.createdAt, { zone: tz }).toFormat("MMM d, yyyy")}</span>
                    <span>Owner: {c.assignedTo?.name ?? "Unassigned"}</span>
                    {c._count.responsibilities > 0 ? <span>{c._count.responsibilities} responsible</span> : null}
                    {c.workOrder ? <span>Corrective: {c.workOrder.status}</span> : null}
                    {c.investigatedBy ? <span>Reviewed by {c.investigatedBy.name}</span> : null}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
