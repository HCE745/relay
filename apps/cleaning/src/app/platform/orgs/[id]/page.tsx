import Link from "next/link"
import { notFound } from "next/navigation"
import { getOrganizationDetail, getOrgEntitlements } from "@/lib/data/platform"
import { EntitlementsEditor } from "@/components/platform/entitlements-editor"

export const dynamic = "force-dynamic"

const TIER_LABEL: Record<string, string> = { SOLO: "Solo", TEAM: "Essentials", BUSINESS: "Professional", ENTERPRISE: "Enterprise" }
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [data, entitlements] = await Promise.all([getOrganizationDetail(id), getOrgEntitlements(id)])
  if (!data) notFound()
  const { org, users, feedback } = data

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform/orgs" className="text-sm text-slate-400 hover:text-white">← Organizations</Link>
        <h1 className="mt-2 text-xl font-semibold text-white">{org.name} {org.isDemo ? <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">DEMO</span> : null}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{org.slug}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Plan" value={TIER_LABEL[org.packageTier] ?? org.packageTier} />
        <Field label="Subscription" value={org.subscriptionStatus.replace("_", " ")} />
        <Field label="Stripe customer" value={org.stripeCustomerId ?? "—"} />
        <Field label="Trial ends" value={fmt(org.trialEndsAt)} />
        <Field label="Onboarded" value={fmt(org.onboardingCompletedAt)} />
        <Field label="Created" value={fmt(org.createdAt)} />
        {org.isDemo ? <Field label="Demo expires" value={fmt(org.demoExpiresAt)} /> : null}
        <Field label="Timezone" value={org.timezone} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter label="Customers" value={org._count.customers} />
        <Counter label="Locations" value={org._count.serviceLocations} />
        <Counter label="Jobs" value={org._count.jobs} />
        <Counter label="Invoices" value={org._count.invoices} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Users ({users.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Email</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}><td className="px-4 py-2 text-slate-100">{u.name}</td><td className="px-4 py-2 text-slate-400">{u.email}</td><td className="px-4 py-2 text-slate-300">{u.role.toLowerCase()}</td><td className="px-4 py-2">{u.isActive ? <span className="text-emerald-400">Active</span> : <span className="text-slate-500">Inactive</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {feedback.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Recent product feedback</h2>
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {feedback.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <Link href={`/feedback/${f.id}`} className="text-slate-200 hover:text-brand-400">{f.title}</Link>
                <span className="text-xs text-slate-500">{f.type.toLowerCase()} · {f.status.replace("_", " ").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entitlements ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Entitlements</h2>
          <p className="mb-2 text-xs text-slate-500">Per-org capability overrides on top of the <span className="text-slate-300">{org.packageTier}</span> plan. Grants/revokes here take effect immediately and do <span className="text-slate-300">not</span> change Stripe billing or the plan tier.</p>
          <EntitlementsEditor orgId={org.id} rows={entitlements.rows} />
        </section>
      ) : null}

      <p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-500">Plan tier and billing state remain driven by Stripe; this portal adjusts only per-org capability overrides, and does not impersonate users. Entitlement changes are written to the organization&apos;s audit log.</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-0.5 break-all text-sm text-slate-200">{value}</div></div>
}
function Counter({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center"><div className="text-xl font-semibold text-slate-100">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
}
