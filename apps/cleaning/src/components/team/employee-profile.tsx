"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, StatusBadge } from "@/components/ui/controls"
import { UserRowActions, type TeamUser } from "@/components/team/team-dialogs"

// Serializable shapes passed from the server page (no Prisma types cross the boundary).
export type ProfileProps = {
  user: TeamUser & { hireDate: string | null; employmentStatus: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null; availability: string | null }
  roles: string[]
  canManage: boolean
  showCompensation: boolean
  jobs: { upcoming: JobRow[]; recent: JobRow[] }
  timeEntries: TimeRow[]
  credentials: CredRow[]
  held: { accessItems: { id: string; label: string; type: string; siteName: string | null }[]; assets: { id: string; label: string; category: string }[]; total: number }
  unavailability: { id: string; startDate: string; endDate: string; reason: string | null }[]
  timeOff: { id: string; startDate: string; endDate: string; status: string; reason: string | null }[]
  outstandingSops: number
  skills: { id: string; name: string }[]
  onboarding: { id: string; packetName: string; assignedAt: string; completedAt: string | null; total: number; done: number }[]
  performance: PerfSummary | null
  reportsHref: string | null
}
type JobRow = { id: string; title: string; when: string; customer: string; site: string; status: string; progress: string }
type TimeRow = { id: string; day: string; span: string; hours: string; status: string; job: string | null }
type CredRow = { id: string; type: string; status: string; expiry: string | null }
type PerfSummary = { completionRate: number; verificationPassRate: number; rework: number; substantiated: number; assigned: number; completed: number }

const TABS = ["Overview", "Schedule & work", "Timekeeping", "Skills & compliance", "Onboarding"] as const
type Tab = (typeof TABS)[number] | "Performance"

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  ACTIVE: "success", APPROVED: "success", COMPLETED: "success", VERIFIED: "success",
  PENDING: "warning", OPEN: "warning", SUBMITTED: "info",
  DENIED: "danger", REJECTED: "danger", EXPIRED: "danger", INACTIVE: "neutral", TERMINATED: "neutral",
}
const tone = (s: string) => STATUS_TONE[s] ?? "neutral"
const titleize = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

export function EmployeeProfile(props: ProfileProps) {
  const tabs: Tab[] = props.performance ? [...TABS, "Performance"] : [...TABS]
  const [tab, setTab] = useState<Tab>("Overview")
  const u = props.user

  return (
    <div className="space-y-5">
      <div>
        <Link href="/team" className="text-sm text-slate-500 hover:text-brand">← Team</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{u.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{titleize(u.role)}</span>
              <StatusBadge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</StatusBadge>
              {u.employmentStatus ? <StatusBadge tone={tone(u.employmentStatus)}>{titleize(u.employmentStatus)}</StatusBadge> : null}
              {props.held.total > 0 ? <Link href="/access/outstanding" className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{props.held.total} key/asset held</Link> : null}
            </p>
          </div>
          <UserRowActions user={u} roles={props.roles} canManage={props.canManage} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t ? "border-brand text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? <Overview {...props} /> : null}
      {tab === "Schedule & work" ? <ScheduleWork jobs={props.jobs} /> : null}
      {tab === "Timekeeping" ? <Timekeeping {...props} /> : null}
      {tab === "Skills & compliance" ? <SkillsCompliance skills={props.skills} credentials={props.credentials} held={props.held} /> : null}
      {tab === "Onboarding" ? <Onboarding onboarding={props.onboarding} outstandingSops={props.outstandingSops} /> : null}
      {tab === "Performance" && props.performance ? <Performance p={props.performance} userId={u.id} reportsHref={props.reportsHref} /> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  )
}

function Overview(props: ProfileProps) {
  const u = props.user
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Row label="Email" value={u.email || "—"} />
        <Row label="Phone" value={u.phone || "—"} />
        <Row label="Employee code" value={u.employeeCode || "—"} />
        <Row label="Hire date" value={u.hireDate || "—"} />
        <Row label="Emergency contact" value={u.emergencyContactName ? `${u.emergencyContactName}${u.emergencyContactPhone ? ` · ${u.emergencyContactPhone}` : ""}` : "—"} />
        <Row label="Availability" value={u.availability || "—"} />
      </Card>
      {props.showCompensation ? (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Compensation (restricted)</div>
          <Row label="Pay type" value={u.payType ? titleize(u.payType) : "—"} />
          <Row label="Pay rate" value={u.payRate ? `$${u.payRate}` : "—"} />
        </Card>
      ) : null}
      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">At a glance</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Upcoming jobs (30d)" value={String(props.jobs.upcoming.length)} />
          <Row label="Skills" value={String(props.skills.length)} />
          <Row label="Open onboarding" value={String(props.onboarding.filter((o) => !o.completedAt).length)} />
          <Row label="SOPs to acknowledge" value={props.outstandingSops > 0 ? <span className="font-semibold text-amber-700">{props.outstandingSops}</span> : "0"} />
        </div>
      </Card>
    </div>
  )
}

function ScheduleWork({ jobs }: { jobs: ProfileProps["jobs"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JobList title="Upcoming" rows={jobs.upcoming} empty="No upcoming assignments in the next 30 days." />
      <JobList title="Recent" rows={jobs.recent} empty="No recent assignments." />
    </div>
  )
}
function JobList({ title, rows, empty }: { title: string; rows: JobRow[]; empty: string }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((j) => (
            <li key={j.id} className="py-2.5">
              <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
                <span className="min-w-0"><span className="font-medium text-slate-900">{j.customer}</span> <span className="text-slate-500">· {j.site}</span></span>
                <span className="shrink-0 text-xs text-slate-400">{j.when}</span>
              </Link>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><StatusBadge tone={tone(j.status)}>{titleize(j.status)}</StatusBadge>{j.progress ? <span>{j.progress}</span> : null}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Timekeeping(props: ProfileProps) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent time entries</h3>
        {props.timeEntries.length === 0 ? <p className="text-sm text-slate-400">No time entries.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-1.5 font-medium">Day</th><th className="py-1.5 font-medium">Span</th><th className="py-1.5 font-medium">Hours</th><th className="py-1.5 font-medium">Status</th><th className="py-1.5 font-medium">Job</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {props.timeEntries.map((e) => (
                <tr key={e.id}><td className="py-2 font-medium text-slate-800">{e.day}</td><td className="py-2 text-slate-600">{e.span}</td><td className="py-2 tabular-nums text-slate-600">{e.hours}</td><td className="py-2"><StatusBadge tone={tone(e.status)}>{titleize(e.status)}</StatusBadge></td><td className="py-2 text-slate-500">{e.job ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Time off</h3>
          {props.timeOff.length === 0 ? <p className="text-sm text-slate-400">No time-off requests.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {props.timeOff.map((t) => <li key={t.id} className="flex items-center justify-between py-2"><span className="text-slate-700">{t.startDate} – {t.endDate}{t.reason ? ` · ${t.reason}` : ""}</span><StatusBadge tone={tone(t.status)}>{titleize(t.status)}</StatusBadge></li>)}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Unavailability</h3>
          {props.unavailability.length === 0 ? <p className="text-sm text-slate-400">No unavailability on record.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {props.unavailability.map((a) => <li key={a.id} className="flex items-center justify-between py-2"><span className="text-slate-700">{a.startDate} – {a.endDate}</span><span className="text-xs text-slate-400">{a.reason ?? ""}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function SkillsCompliance({ skills, credentials, held }: { skills: ProfileProps["skills"]; credentials: CredRow[]; held: ProfileProps["held"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Skills & certifications</h3>
        {skills.length === 0 ? <p className="text-sm text-slate-400">No skills assigned. Manage in <Link href="/skills" className="text-brand hover:underline">Skills</Link>.</p> : (
          <div className="flex flex-wrap gap-1.5">{skills.map((s) => <StatusBadge key={s.id} tone="info">{s.name}</StatusBadge>)}</div>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Credentials</h3>
        {credentials.length === 0 ? <p className="text-sm text-slate-400">No credentials on file. Manage in <Link href="/compliance" className="text-brand hover:underline">Compliance</Link>.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {credentials.map((c) => <li key={c.id} className="flex items-center justify-between py-2"><span className="text-slate-700">{titleize(c.type)}{c.expiry ? ` · exp ${c.expiry}` : ""}</span><StatusBadge tone={tone(c.status)}>{titleize(c.status)}</StatusBadge></li>)}
          </ul>
        )}
      </Card>
      {held.total > 0 ? (
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Keys & assets held</h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {held.accessItems.map((i) => <span key={i.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{titleize(i.type)} {i.label}{i.siteName ? ` · ${i.siteName}` : ""}</span>)}
            {held.assets.map((a) => <span key={a.id} className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{a.label}</span>)}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function Onboarding({ onboarding, outstandingSops }: { onboarding: ProfileProps["onboarding"]; outstandingSops: number }) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Onboarding</h3>
        {onboarding.length === 0 ? <p className="text-sm text-slate-400">No onboarding packets assigned.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {onboarding.map((o) => <li key={o.id} className="flex items-center justify-between py-2"><span className="text-slate-700">{o.packetName}</span><span className="text-xs text-slate-400">{o.done}/{o.total} tasks {o.completedAt ? "· complete" : ""}</span></li>)}
          </ul>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">SOP acknowledgments</h3>
        <p className="text-sm text-slate-600">{outstandingSops > 0 ? <span className="font-semibold text-amber-700">{outstandingSops} outstanding</span> : "All current SOPs acknowledged."}</p>
      </Card>
    </div>
  )
}

function Performance({ p, userId, reportsHref }: { p: PerfSummary; userId: string; reportsHref: string | null }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Assigned" value={String(p.assigned)} />
        <Stat label="Completed" value={String(p.completed)} />
        <Stat label="Completion" value={`${p.completionRate}%`} />
        <Stat label="Verify pass" value={`${p.verificationPassRate}%`} />
        <Stat label="Rework" value={String(p.rework)} warn={p.rework > 0} />
        <Stat label="Substantiated" value={String(p.substantiated)} warn={p.substantiated > 0} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/performance/${userId}`} className="text-sm font-medium text-brand hover:underline">Full accountability history →</Link>
        {reportsHref ? <Link href={reportsHref} className="text-sm font-medium text-brand hover:underline">Workplace reports →</Link> : null}
      </div>
    </div>
  )
}
function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <Card className="p-4"><div className="text-xs text-slate-400">{label}</div><div className={`mt-1 text-xl font-semibold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</div></Card>
}
