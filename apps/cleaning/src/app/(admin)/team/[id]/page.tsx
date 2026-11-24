import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canManageTeam, assignableRoles } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getEmployeeProfile } from "@/lib/data/employee-profile"
import { getEmployeePerformance } from "@/lib/data/performance"
import { getOrgTimezone } from "@/lib/data/org"
import { EmployeeProfile } from "@/components/team/employee-profile"

export const dynamic = "force-dynamic"

const d = (date: Date | null, tz: string, fmt = "LLL d, yyyy") => (date ? DateTime.fromJSDate(date, { zone: tz }).toFormat(fmt) : null)

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageTeam(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, "workforce.employees"))) redirect("/dashboard")

  const { id } = await params
  const orgId = session.organizationId
  const [profile, tz] = await Promise.all([getEmployeeProfile(orgId, id), getOrgTimezone(orgId)])
  if (!profile) notFound()

  const [hasPerformance, hasReports] = await Promise.all([
    orgHasCapability(orgId, "workforce.performanceAnalytics"),
    orgHasCapability(orgId, "operations.employeeReports"),
  ])
  const perf = hasPerformance ? await getEmployeePerformance(orgId, id) : null

  const u = profile.user
  const ep = u.employeeProfile

  const hoursOf = (e: (typeof profile.timeEntries)[number]) => {
    if (!e.clockOutAt) return "—"
    const mins = Math.max(0, (e.clockOutAt.getTime() - e.clockInAt.getTime()) / 60000 - e.breakMinutes)
    return `${(mins / 60).toFixed(2)} h`
  }

  return (
    <EmployeeProfile
      user={{
        id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, isActive: u.isActive,
        employeeCode: ep?.employeeCode ?? null,
        payType: ep?.payType ?? null,
        payRate: ep?.payRate != null ? String(ep.payRate) : null,
        hireDate: d(ep?.hireDate ?? null, tz),
        employmentStatus: ep?.employmentStatus ?? null,
        emergencyContactName: ep?.emergencyContactName ?? null,
        emergencyContactPhone: ep?.emergencyContactPhone ?? null,
        availability: ep?.availability ?? null,
      }}
      roles={assignableRoles(session.role)}
      canManage={u.id !== session.userId}
      showCompensation={canManageTeam(session.role)}
      jobs={{
        upcoming: profile.jobs.upcoming.map((j) => mapJob(j, tz)),
        recent: profile.jobs.recent.map((j) => mapJob(j, tz)),
      }}
      timeEntries={profile.timeEntries.map((e) => ({
        id: e.id,
        day: DateTime.fromJSDate(e.clockInAt, { zone: tz }).toFormat("ccc, LLL d"),
        span: `${DateTime.fromJSDate(e.clockInAt, { zone: tz }).toFormat("h:mm a")} – ${e.clockOutAt ? DateTime.fromJSDate(e.clockOutAt, { zone: tz }).toFormat("h:mm a") : "in progress"}`,
        hours: hoursOf(e),
        status: e.status,
        job: e.job ? (e.job.serviceLocation?.customer.name ?? e.job.title) : null,
      }))}
      credentials={profile.credentials.map((c) => ({ id: c.id, type: c.type, status: c.status, expiry: d(c.expiryDate, tz) }))}
      held={{ accessItems: profile.held.accessItems, assets: profile.held.assets.map((a) => ({ id: a.id, label: a.label, category: a.category })), total: profile.held.total }}
      unavailability={profile.unavailability.map((a) => ({ id: a.id, startDate: d(a.startDate, tz)!, endDate: d(a.endDate, tz)!, reason: a.reason }))}
      timeOff={profile.timeOff.map((t) => ({ id: t.id, startDate: d(t.startDate, tz)!, endDate: d(t.endDate, tz)!, status: t.status, reason: t.reason }))}
      outstandingSops={profile.outstandingSops}
      skills={profile.skills}
      onboarding={profile.onboarding.map((o) => ({ id: o.id, packetName: o.packetName, assignedAt: d(o.assignedAt, tz)!, completedAt: d(o.completedAt, tz), total: o.total, done: o.done }))}
      performance={perf ? {
        completionRate: perf.summary.completionRate,
        verificationPassRate: perf.summary.verificationPassRate,
        rework: perf.summary.rework,
        substantiated: perf.summary.complaints.substantiated,
        assigned: perf.summary.tasks.assigned,
        completed: perf.summary.tasks.completed,
      } : null}
      reportsHref={hasReports ? "/reports/employee" : null}
    />
  )
}

function mapJob(j: { id: string; title: string; status: string; scheduledStart: Date; serviceLocation: { name: string; timezone: string | null; customer: { name: string } }; checklistItems: { isComplete: boolean }[] }, orgTz: string) {
  const jtz = j.serviceLocation.timezone ?? orgTz
  const done = j.checklistItems.filter((c) => c.isComplete).length
  return {
    id: j.id,
    title: j.title,
    when: DateTime.fromJSDate(j.scheduledStart, { zone: jtz }).toFormat("LLL d, h:mm a"),
    customer: j.serviceLocation.customer.name,
    site: j.serviceLocation.name,
    status: j.status,
    progress: j.checklistItems.length ? `${done}/${j.checklistItems.length} tasks` : "",
  }
}
