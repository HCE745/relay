import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getOrgTimezone } from "@/lib/data/org"
import { getDashboardMetrics } from "@/lib/data/dashboard"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const m = await getDashboardMetrics(orgId, tz)

  const tiles: Array<{ label: string; value: number; href: string; alert?: boolean }> = [
    { label: "Scheduled today", value: m.scheduledToday, href: "/schedule" },
    { label: "In progress", value: m.inProgress, href: "/schedule" },
    { label: "Completed today", value: m.completedToday, href: "/schedule" },
    { label: "Unassigned", value: m.unassigned, href: "/schedule", alert: m.unassigned > 0 },
    { label: "Understaffed", value: m.understaffed, href: "/schedule", alert: m.understaffed > 0 },
    { label: "Awaiting inspection", value: m.awaitingInspection, href: "/jobs", alert: m.awaitingInspection > 0 },
    { label: "Failed inspections", value: m.failedInspections, href: "/inspections", alert: m.failedInspections > 0 },
    { label: "Open problems", value: m.openIssues, href: "/issues", alert: m.openIssues > 0 },
    { label: "Time to approve", value: m.pendingApproval, href: "/time", alert: m.pendingApproval > 0 },
  ]

  return (
    <div>
      <PageHeader
        title={session.role === "SUPERVISOR" ? "Supervisor Dashboard" : "Dashboard"}
        subtitle={`What needs attention today · ${session.name}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className={`p-5 transition hover:border-brand ${t.alert ? "border-orange-200 bg-orange-50/40" : ""}`}>
              <p className="text-sm font-medium text-slate-600">{t.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${t.alert ? "text-orange-600" : "text-slate-900"}`}>{t.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
