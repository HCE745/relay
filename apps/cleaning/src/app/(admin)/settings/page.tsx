import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageOrg } from "@/lib/rbac"
import { getOrgSettings } from "@/lib/data/org"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { OrgTimezoneForm } from "@/components/settings/org-timezone-form"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const org = await getOrgSettings(session.organizationId)
  const isOrgAdmin = canManageOrg(session.role)

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Organization & workspace configuration" />

      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Organization</dt>
            <dd className="text-sm font-medium text-slate-900">{org?.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Package</dt>
            <dd className="text-sm font-medium text-slate-900">{session.packageTier}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Your role</dt>
            <dd className="text-sm font-medium text-slate-900">{session.role}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Scheduling timezone</h2>
        {isOrgAdmin ? (
          <div className="mt-3">
            <OrgTimezoneForm current={org?.timezone ?? "America/New_York"} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Current timezone: <span className="font-medium">{org?.timezone}</span>. Only owners and admins can change it.
          </p>
        )}
      </Card>
    </div>
  )
}
