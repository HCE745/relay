import Link from "next/link"
import { platformOverview } from "@/lib/data/platform"

export const dynamic = "force-dynamic"

function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "warn" | "ok" }) {
  const body = (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-slate-100"}`}>{value}</div>
    </div>
  )
  return href ? <Link href={href} className="block transition hover:border-slate-600">{body}</Link> : body
}

export default async function PlatformOverviewPage() {
  const o = await platformOverview()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Platform overview</h1>
        <p className="mt-0.5 text-sm text-slate-400">Live counts across all customer organizations. Figures are read directly from the database — nothing here is estimated.</p>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Organizations</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total orgs" value={o.totalOrgs} href="/platform/orgs" />
          <Stat label="Active" value={o.active} tone="ok" />
          <Stat label="Trialing" value={o.trialing} />
          <Stat label="Past due" value={o.pastDue} tone={o.pastDue > 0 ? "warn" : undefined} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Usage & support</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Staff users" value={o.users} />
          <Stat label="Customers" value={o.customers} />
          <Stat label="Active demos" value={o.demoOrgs} href="/platform/demos" />
          <Stat label="Open feedback" value={o.feedbackOpen} href="/feedback" tone={o.feedbackOpen > 0 ? "warn" : undefined} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Scope of this portal</p>
        <p className="mt-1">Read-only platform visibility plus the product-feedback console. Subscription tier and billing state are shown as they are in the database and Stripe; this portal does not change Stripe subscriptions, and there is no customer impersonation. Changes to a customer&apos;s plan remain a billing operation.</p>
      </div>
    </div>
  )
}
