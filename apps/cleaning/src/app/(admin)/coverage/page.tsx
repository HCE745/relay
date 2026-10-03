import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listUncoveredShifts } from "@/lib/data/coverage"
import { listTimeOff } from "@/lib/data/timeoff"
import { listUnavailability } from "@/lib/data/availability"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { AlertTriangleIcon } from "@/components/ui/icons"
import { CoverageClient } from "@/components/coverage/coverage-client"

export const dynamic = "force-dynamic"
const CAP = "workforce.coverage"

export default async function CoveragePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Coverage" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [shifts, pending, blocks, users] = await Promise.all([
    listUncoveredShifts(orgId, { hoursAhead: 48 }),
    listTimeOff(orgId, { status: "PENDING" }),
    listUnavailability(orgId, { from: new Date() }),
    listUsers(orgId),
  ])
  const members = users.filter((u) => u.isActive && (u.role === "CLEANER" || u.role === "SUPERVISOR")).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div>
      <PageHeader title="Coverage" subtitle="Callouts, availability and shift reassignment" icon={<AlertTriangleIcon />} />
      <CoverageClient
        shifts={shifts.map((s) => ({ ...s, scheduledStart: s.scheduledStart.toISOString() }))}
        pending={pending.map((p) => ({ id: p.id, userName: p.user.name, startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString(), reason: p.reason }))}
        members={members}
        blocks={blocks.map((b) => ({ id: b.id, userName: b.user.name, startDate: b.startDate.toISOString(), endDate: b.endDate.toISOString(), reason: b.reason, source: b.source }))}
      />
    </div>
  )
}
