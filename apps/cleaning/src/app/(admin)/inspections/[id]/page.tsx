import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canInspect } from "@/lib/rbac"
import { getInspection } from "@/lib/scheduling/inspections"
import { getOrgTimezone } from "@/lib/data/org"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { InspectionRunner } from "@/components/inspections/inspection-runner"

export const dynamic = "force-dynamic"

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")

  const { id } = await params
  const inspection = await getInspection(session.organizationId, id)
  if (!inspection) notFound()

  const tz = await getOrgTimezone(session.organizationId)
  const finalized = inspection.status === "FINALIZED"
  const editable = !finalized && canInspect(session.role)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        {inspection.job ? (
          <Link href={`/jobs/${inspection.job.id}`} className="text-sm text-slate-500 hover:text-brand">
            ← Job
          </Link>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-4">
          <PageHeader
            title="Inspection"
            subtitle={`${inspection.serviceLocation.customer.name} · ${inspection.serviceLocation.name}`}
          />
          {finalized ? (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                inspection.outcome === "PASS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {inspection.outcome} · {inspection.score}%
            </span>
          ) : null}
        </div>
      </div>

      {finalized ? (
        <Card className="p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Template" value={inspection.templateName} />
            <Detail label="Inspector" value={inspection.inspector.name} />
            <Detail label="Score" value={`${inspection.score}% (threshold ${inspection.passThreshold}%)`} />
            <Detail
              label="Finalized"
              value={inspection.finalizedAt ? DateTime.fromJSDate(inspection.finalizedAt, { zone: tz }).toFormat("MMM d, yyyy · h:mm a") : "—"}
            />
          </dl>
          {inspection.comments ? <Detail label="Comments" value={inspection.comments} /> : null}
          <div className="mt-4 space-y-1.5">
            {inspection.results.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-t border-slate-100 py-1.5 text-sm">
                <span className="text-slate-700">
                  {r.label}
                  {r.isCritical ? <span className="ml-1 text-xs text-red-500">critical</span> : null}
                </span>
                <span
                  className={
                    r.result === "PASS"
                      ? "text-emerald-600"
                      : r.result === "FAIL"
                        ? "text-red-600"
                        : "text-slate-400"
                  }
                >
                  {r.result}
                </span>
              </div>
            ))}
          </div>
          {inspection.issue ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              A quality issue was created from this failed inspection.
            </p>
          ) : null}
        </Card>
      ) : (
        <InspectionRunner
          inspectionId={inspection.id}
          jobId={inspection.job?.id ?? null}
          templateName={inspection.templateName}
          passThreshold={inspection.passThreshold}
          siteName={inspection.serviceLocation.name}
          customerName={inspection.serviceLocation.customer.name}
          canEdit={editable}
          results={inspection.results.map((r) => ({
            id: r.id,
            label: r.label,
            instructions: r.instructions,
            points: r.points,
            isCritical: r.isCritical,
            requirePhoto: r.requirePhoto,
            result: r.result,
            note: r.note,
            hasPhoto: r.photos.length > 0,
          }))}
        />
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  )
}
