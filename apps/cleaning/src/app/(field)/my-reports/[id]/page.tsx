import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { getOrgTimezone } from "@/lib/data/org"
import { getReport } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"
import { categoryLabel, STATUS_META, CONFIDENTIALITY_META } from "@/lib/employee-reports/labels"

export const dynamic = "force-dynamic"

// Employee-facing detail for a report the signed-in person submitted — including
// confidential reports. The data layer returns the REDACTED view for a reporter:
// status + what they filed + their own evidence only. The investigator's finding,
// the reviewer's identity, the subject's response, and restricted evidence are
// never present here.
export default async function MyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "operations.employeeReports"))) redirect("/today")

  const { id } = await params
  const actor = { userId: session.userId, role: session.role as ActorRole }

  let report: Awaited<ReturnType<typeof getReport>>
  try {
    report = await getReport(orgId, actor, id)
  } catch {
    notFound() // not theirs or missing → indistinguishable 404
  }
  report = report!

  // Only the reporter's own-filed reports belong in this view. If they somehow
  // reached a report they merely have management access to, send them to the
  // management surface instead of exposing the field view.
  if (report.reportedById !== session.userId) notFound()

  const tz = await getOrgTimezone(orgId)
  const status = STATUS_META[report.status] ?? { label: report.status, cls: "bg-slate-100 text-slate-600" }
  const conf = CONFIDENTIALITY_META[report.confidentiality] ?? { label: report.confidentiality, cls: "bg-slate-100 text-slate-600" }
  const isOpen = ["SUBMITTED", "PENDING_REVIEW", "UNDER_REVIEW"].includes(report.status)

  return (
    <div className="space-y-4">
      <Link href="/my-reports" className="text-sm text-slate-500">
        ← My reports
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{report.title || categoryLabel(report.category)}</h1>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={`rounded px-1.5 py-0.5 font-medium ${conf.cls}`}>{conf.label}</span>
          <span>{categoryLabel(report.category)}</span>
          <span>Submitted {DateTime.fromJSDate(report.createdAt, { zone: tz }).toFormat("LLL d, yyyy")}</span>
        </div>

        <dl className="mt-3 space-y-2 text-sm">
          {report.about?.name ? (
            <div>
              <dt className="text-xs font-medium text-slate-400">About</dt>
              <dd className="text-slate-700">{report.about.name}</dd>
            </div>
          ) : null}
          {report.job?.title ? (
            <div>
              <dt className="text-xs font-medium text-slate-400">Job</dt>
              <dd className="text-slate-700">{report.job.title}{report.checklistItem?.label ? ` · ${report.checklistItem.label}` : ""}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-slate-400">What you reported</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{report.description}</dd>
          </div>
        </dl>
      </div>

      {report.photos.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Photos you added</h2>
          <div className="grid grid-cols-3 gap-2">
            {report.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={`/api/photos/${p.id}`} alt="Evidence" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        {isOpen
          ? "This report is an allegation under review. Management's investigation notes and any response from the person named are kept private. A report never counts against anyone unless a review finds it substantiated."
          : "This report has been reviewed. The investigation details are kept private to management. A report only counts against anyone if a review found it substantiated."}
      </div>
    </div>
  )
}
