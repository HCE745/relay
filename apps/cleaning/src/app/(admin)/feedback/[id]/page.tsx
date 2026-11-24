import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { isPlatformAdmin } from "@/lib/platform-admin"
import { getFeedbackAny, FEEDBACK_STATUSES } from "@/lib/data/feedback"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge, Select, Textarea, Button } from "@/components/ui/controls"
import { setFeedbackStatus } from "../actions"

export const dynamic = "force-dynamic"
const fmtDT = (d: Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!isPlatformAdmin(session)) redirect("/dashboard")
  const { id } = await params
  const fb = await getFeedbackAny(id)
  if (!fb) notFound()

  const typeLabel = fb.type.charAt(0) + fb.type.slice(1).toLowerCase()

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/feedback" className="text-sm text-slate-500 hover:text-slate-700">← All feedback</Link>
      <PageHeader
        title={fb.title}
        subtitle={`${typeLabel} · ${fb.organization?.name ?? "Unknown org"} · from ${fb.submittedByName ?? "a user"} · ${fmtDT(fb.createdAt)}`}
        action={<StatusBadge tone="info">{fb.status.replace("_", " ")}</StatusBadge>}
      />
      {fb.isDemo ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Submitted from a demo workspace.</div> : null}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Description</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{fb.description}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 pt-2 text-xs text-slate-500 sm:grid-cols-2">
          {fb.pageUrl ? <div><dt className="inline font-medium">Page:</dt> <dd className="inline">{fb.pageUrl}</dd></div> : null}
          {fb.submittedByEmail ? <div><dt className="inline font-medium">From:</dt> <dd className="inline">{fb.submittedByEmail}</dd></div> : null}
          {fb.userAgent ? <div className="sm:col-span-2 truncate"><dt className="inline font-medium">Browser:</dt> <dd className="inline">{fb.userAgent}</dd></div> : null}
        </dl>
      </Card>

      {fb.attachments.length > 0 ? (
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Attachments ({fb.attachments.length})</h2>
          {fb.consentVisual ? <p className="text-xs text-slate-400">Submitter consented to attaching visual evidence.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {fb.attachments.map((a) => {
              const src = `/api/feedback/attachments/${a.id}`
              return (
                <div key={a.id} className="overflow-hidden rounded-lg border border-slate-200">
                  {a.contentType.startsWith("video/") ? (
                    <video src={src} controls className="h-48 w-full bg-black object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={a.name ?? a.kind} className="h-48 w-full bg-slate-50 object-contain" /></a>
                  )}
                  <div className="px-3 py-1.5 text-[11px] text-slate-500">{a.kind.toLowerCase()} · {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Manage</h2>
        <form action={setFeedbackStatus} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
            <Select name="status" defaultValue={fb.status}>
              {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Resolution note (optional)</label>
            <Textarea name="resolutionNote" rows={3} defaultValue={fb.resolutionNote ?? ""} placeholder="What's the decision or fix?" />
          </div>
          <Button type="submit">Save</Button>
        </form>
        {fb.resolvedAt ? <p className="text-xs text-slate-400">Last resolved {fmtDT(fb.resolvedAt)}.</p> : null}
      </Card>
    </div>
  )
}
