import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { getSupervisorDashboard } from "@/lib/data/supervisor"
import { getOrgTimezone } from "@/lib/data/org"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { UsersIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"

const sev: Record<string, BadgeTone> = { CRITICAL: "danger", HIGH: "danger", MEDIUM: "warning", LOW: "neutral" }
const titleize = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

export default async function MyTeamPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  const [d, tz] = await Promise.all([getSupervisorDashboard(orgId, session.userId), getOrgTimezone(orgId)])

  return (
    <div className="space-y-6">
      <PageHeader title="My team" subtitle="Your assigned locations, crew and open work" icon={<UsersIcon />} />

      {d.empty ? (
        <Card className="p-6 text-sm text-slate-600">
          You have no assigned locations or crew yet. A manager assigns a supervisor to a site from the site page, and to an employee from their profile. Once assigned, this page shows that site&apos;s jobs, inspections, issues, corrective work and supply requests.
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Locations" value={d.sites.length} />
            <Stat label="Crew" value={d.crew.length} />
            <Stat label="Open issues" value={d.openIssues.length} tone={d.openIssues.length ? "warn" : undefined} />
            <Stat label="Corrective work" value={d.corrective.length} tone={d.corrective.length ? "warn" : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Assigned locations</h2>
              {d.sites.length === 0 ? <Empty t="No sites assigned." /> : (
                <ul className="divide-y divide-slate-100">{d.sites.map((s) => (
                  <li key={s.id} className="py-2 text-sm"><Link href={`/customers/${s.customer.id}/sites/${s.id}`} className="font-medium text-slate-900 hover:text-brand">{s.name}</Link> <span className="text-slate-500">· {s.customer.name}</span></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Crew</h2>
              {d.crew.length === 0 ? <Empty t="No crew assigned." /> : (
                <ul className="divide-y divide-slate-100">{d.crew.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2 text-sm"><Link href={`/team/${u.id}`} className="font-medium text-slate-900 hover:text-brand">{u.name}</Link><span className="text-xs text-slate-400">{titleize(u.role)}</span></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Upcoming jobs (7 days)</h2>
              {d.upcomingJobs.length === 0 ? <Empty t="Nothing scheduled." /> : (
                <ul className="divide-y divide-slate-100">{d.upcomingJobs.map((j) => (
                  <li key={j.id} className="py-2 text-sm"><Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 hover:text-brand"><span className="min-w-0 truncate"><span className="font-medium text-slate-900">{j.serviceLocation.customer.name}</span> <span className="text-slate-500">· {j.serviceLocation.name}</span></span><span className="shrink-0 text-xs text-slate-400">{DateTime.fromJSDate(j.scheduledStart, { zone: j.serviceLocation.timezone ?? tz }).toFormat("LLL d, h:mm a")}</span></Link>{j.assignments.length ? <div className="text-xs text-slate-400">{j.assignments.map((a) => a.user.name).join(", ")}</div> : <div className="text-xs text-amber-600">Unassigned</div>}</li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Open issues</h2>
              {d.openIssues.length === 0 ? <Empty t="No open issues." /> : (
                <ul className="divide-y divide-slate-100">{d.openIssues.map((i) => (
                  <li key={i.id} className="py-2 text-sm"><Link href={`/issues/${i.id}`} className="flex items-center justify-between gap-2 hover:text-brand"><span className="min-w-0 truncate text-slate-800">{(i.title ?? i.description).slice(0, 44)} <span className="text-slate-400">· {i.serviceLocation?.name}</span></span><StatusBadge tone={sev[i.severity] ?? "neutral"}>{titleize(i.severity)}</StatusBadge></Link></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Inspections</h2>
              {d.inspections.length === 0 ? <Empty t="No inspections." /> : (
                <ul className="divide-y divide-slate-100">{d.inspections.map((ins) => (
                  <li key={ins.id} className="py-2 text-sm"><Link href={`/inspections/${ins.id}`} className="flex items-center justify-between gap-2 hover:text-brand"><span className="truncate text-slate-800">{ins.templateName} · {ins.serviceLocation.name}</span><span className={ins.outcome === "PASS" ? "text-emerald-600" : ins.outcome === "FAIL" ? "text-red-600" : "text-slate-400"}>{ins.outcome ? `${ins.outcome} ${ins.score ?? ""}` : titleize(ins.status)}</span></Link></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Supply requests</h2>
              {d.supplyRequests.length === 0 ? <Empty t="No open requests." /> : (
                <ul className="divide-y divide-slate-100">{d.supplyRequests.map((r) => (
                  <li key={r.id} className="py-2 text-sm text-slate-700">{r.supply?.name ?? "General"}{r.quantity ? ` · ${Number(r.quantity)}` : ""} <span className="text-xs text-slate-400">by {r.requestedBy.name} · {r.status.toLowerCase()}</span></li>
                ))}</ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return <Card className="p-4"><div className="text-xs text-slate-400">{label}</div><div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</div></Card>
}
const Empty = ({ t }: { t: string }) => <p className="text-sm text-slate-400">{t}</p>
