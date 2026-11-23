import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { getMyPerformance } from "@/lib/data/performance"
import { TrendBars } from "@/components/performance/trend-bars"

export const dynamic = "force-dynamic"

// Employee-facing OWN work history (P4). Privacy: a cleaner sees only their own
// record. Complaints appear only as a substantiated-findings count — never an
// allegation, the complaint text, the customer, or who reported it.
export default async function MyWorkPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "workforce.performanceAnalytics"))) redirect("/today")

  const p = await getMyPerformance(orgId, session.userId)

  return (
    <div className="space-y-5">
      <div>
        <Link href="/today" className="text-sm text-slate-500">← Today</Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">My work history</h1>
        <p className="mt-0.5 text-sm text-slate-500">Your tasks, completion, and verification record.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Tasks completed" value={`${p.tasks.completed}/${p.tasks.assigned}`} />
        <Tile label="Completion rate" value={`${p.completionRate}%`} />
        <Tile label="Verification pass" value={`${p.verificationPassRate}%`} />
        <Tile label="Needs rework" value={String(p.rework)} tone={p.rework > 0 ? "warn" : undefined} />
        <Tile label="Corrective work" value={`${p.corrective.completed}/${p.corrective.assigned}`} />
        <Tile label="Substantiated findings" value={String(p.substantiatedFindings)} tone={p.substantiatedFindings > 0 ? "warn" : undefined} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Last 6 months</h2>
        <TrendBars points={p.trend} />
      </div>

      <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        Only reviewed, substantiated findings are shown here. Unproven complaints never appear and never count against your record.
      </p>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  )
}
