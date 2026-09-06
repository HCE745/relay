import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { PageHeader } from "@/components/ui/placeholder"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  return (
    <div>
      <PageHeader title="Settings" subtitle="Organization & workspace configuration" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Package</dt>
            <dd className="text-sm font-medium text-slate-900">{session.packageTier}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Your role</dt>
            <dd className="text-sm font-medium text-slate-900">{session.role}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-500">
          Package & capability management UI arrives in a later phase.
        </p>
      </div>
    </div>
  )
}
