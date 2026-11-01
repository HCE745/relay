import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { orgDb } from "@/lib/org-db"
import { listKiosks, listPinStatus } from "@/lib/data/kiosks"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { KiosksManager } from "@/components/kiosks/kiosks-manager"

export const dynamic = "force-dynamic"
const CAP = "workforce.timeTracking"

export default async function KiosksPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Time-clock kiosks" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [kiosks, sites, pins] = await Promise.all([
    listKiosks(session.organizationId),
    orgDb(session.organizationId).serviceLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listPinStatus(session.organizationId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Time-clock kiosks" subtitle="Shared devices where a crew clocks in and out with a PIN or photo" />
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        A kiosk is a shared device at a site or office. Each punch still creates a per-employee time entry through the
        normal clock path and is written to the audit trail with the kiosk — a shared device never weakens per-user time
        integrity. Register a kiosk to get a one-time activation token, then open <span className="font-mono">/kiosk</span> on the device.
      </Card>
      <KiosksManager kiosks={kiosks} sites={sites} pins={pins} />
    </div>
  )
}
