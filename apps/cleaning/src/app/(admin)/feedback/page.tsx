import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { listFeedback, feedbackCounts, type FeedbackStatus, type FeedbackKind } from "@/lib/data/feedback"
import { getOrgTimezone } from "@/lib/data/org"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge, EmptyState } from "@/components/ui/controls"
import { MessageSquareIcon, BugIcon, LightbulbIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"

const STATUS_TONE: Record<FeedbackStatus, "neutral" | "info" | "warning" | "success"> = {
  NEW: "warning", IN_REVIEW: "info", PLANNED: "info", RESOLVED: "success", CLOSED: "neutral",
}
const TYPE_META: Record<FeedbackKind, { label: string; Icon: (p: { className?: string }) => React.ReactNode }> = {
  BUG: { label: "Bug", Icon: BugIcon },
  FEATURE: { label: "Feature", Icon: LightbulbIcon },
  QUESTION: { label: "Question", Icon: MessageSquareIcon },
}
const STATUSES: FeedbackStatus[] = ["NEW", "IN_REVIEW", "PLANNED", "RESOLVED", "CLOSED"]

export default async function FeedbackListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")

  const { status } = await searchParams
  const activeStatus = STATUSES.includes(status as FeedbackStatus) ? (status as FeedbackStatus) : undefined
  const [rows, counts, tz] = await Promise.all([
    listFeedback(session.organizationId, { status: activeStatus }),
    feedbackCounts(session.organizationId),
    getOrgTimezone(session.organizationId),
  ])
  const countFor = (s: FeedbackStatus) => counts.find((c) => c.status === s)?._count._all ?? 0
  const total = counts.reduce((a, c) => a + c._count._all, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback" subtitle="Bug reports and feature requests from your team" icon={<MessageSquareIcon />} />

      <div className="flex flex-wrap gap-2">
        <Link href="/feedback" className={`rounded-full px-3 py-1 text-sm font-medium ${!activeStatus ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          All ({total})
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/feedback?status=${s}`} className={`rounded-full px-3 py-1 text-sm font-medium ${activeStatus === s ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {s.replace("_", " ")} ({countFor(s)})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquareIcon />} title="No feedback yet" description="Bug reports and feature requests submitted from the Help menu appear here." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const meta = TYPE_META[r.type]
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/feedback/${r.id}`} className="font-medium text-slate-900 hover:text-brand">{r.title}</Link>
                      {r._count.attachments > 0 ? <span className="ml-2 text-xs text-slate-400">📎 {r._count.attachments}</span> : null}
                      {r.isDemo ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">DEMO</span> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-1.5"><meta.Icon className="h-4 w-4 text-slate-400" />{meta.label}</span></td>
                    <td className="px-4 py-3 text-slate-600">{r.submittedByName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{DateTime.fromJSDate(r.createdAt, { zone: tz }).toFormat("MMM d")}</td>
                    <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</StatusBadge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
