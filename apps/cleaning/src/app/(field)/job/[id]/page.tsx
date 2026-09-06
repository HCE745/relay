import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { getFieldJob } from "@/lib/data/field"
import { getOrgTimezone } from "@/lib/data/org"
import { FieldJobClient } from "./field-job-client"

export const dynamic = "force-dynamic"

export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const orgId = session.organizationId
  const job = await getFieldJob(orgId, session.userId, id)
  if (!job) notFound()

  const orgTz = await getOrgTimezone(orgId)
  const tz = job.serviceLocation.timezone ?? orgTz
  const start = DateTime.fromJSDate(job.scheduledStart, { zone: tz })

  const address = [
    job.serviceLocation.addressLine1,
    job.serviceLocation.addressLine2,
    [job.serviceLocation.city, job.serviceLocation.state, job.serviceLocation.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  const isClockedIn = job.timeEntries.some((t) => t.status === "OPEN")

  return (
    <div className="space-y-4">
      <Link href="/today" className="text-sm text-slate-500">
        ← Today
      </Link>
      <FieldJobClient
        jobId={job.id}
        status={job.status}
        title={job.title}
        customerName={job.serviceLocation.customer.name}
        siteName={job.serviceLocation.name}
        address={address}
        siteNotes={job.serviceLocation.notes}
        scheduledLabel={start.toFormat("cccc, LLL d · h:mm a")}
        timezone={tz}
        isClockedIn={isClockedIn}
        jobNoteInitial={job.notes ?? ""}
        openIssues={job.issues.length}
        checklist={job.checklistItems.map((it) => ({
          id: it.id,
          label: it.label,
          instructions: it.instructions,
          isRequired: it.isRequired,
          requirePhoto: it.requirePhoto,
          isComplete: it.isComplete,
          note: it.note,
          hasPhoto: it.photos.length > 0,
        }))}
      />
    </div>
  )
}
