import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageOrg, canManageAccounts } from "@/lib/rbac"
import { getOrgSettings } from "@/lib/data/org"
import { getSetupProgress } from "@/lib/data/setup"
import { isSetupGuideDismissed, restoreSetupGuide } from "@/lib/setup-actions"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { OrgTimezoneForm } from "@/components/settings/org-timezone-form"
import { ChangePasswordForm } from "@/components/settings/change-password-form"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const org = await getOrgSettings(session.organizationId)
  const isOrgAdmin = canManageOrg(session.role)

  const canSetup = canManageAccounts(session.role)
  const [setup, setupDismissed] = canSetup
    ? await Promise.all([getSetupProgress(session.organizationId), isSetupGuideDismissed()])
    : [null, true]
  const setupVisibleOnDashboard = canSetup && setup != null && !setup.allComplete && !setupDismissed

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
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Your password</h2>
        <ChangePasswordForm />
      </Card>

      {canSetup && setup ? (
        <Card className="p-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Setup guide</h2>
          <p className="text-sm text-slate-600">
            {setup.allComplete
              ? "You've completed all setup steps."
              : setupVisibleOnDashboard
                ? `The setup guide is on your dashboard — ${setup.completed} of ${setup.total} steps done.`
                : `The setup guide is hidden — ${setup.completed} of ${setup.total} steps done.`}
          </p>
          {!setupVisibleOnDashboard ? (
            <form action={restoreSetupGuide} className="mt-3">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Show setup guide on dashboard
              </button>
            </form>
          ) : null}
        </Card>
      ) : null}

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
