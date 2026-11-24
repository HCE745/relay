import Link from "next/link"
import { listOrganizations } from "@/lib/data/platform"

export const dynamic = "force-dynamic"

const TIER_LABEL: Record<string, string> = { SOLO: "Solo", TEAM: "Essentials", BUSINESS: "Professional", ENTERPRISE: "Enterprise" }
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400", trialing: "bg-sky-500/15 text-sky-400",
  past_due: "bg-amber-500/15 text-amber-400", canceled: "bg-slate-500/15 text-slate-400",
}
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function OrgDirectoryPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams
  const includeDemo = demo === "1"
  const orgs = await listOrganizations({ includeDemo })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Organizations ({orgs.length})</h1>
          <p className="mt-0.5 text-sm text-slate-400">Every customer organization on the platform.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/platform/orgs" className={`rounded-md px-3 py-1.5 font-medium ${!includeDemo ? "bg-brand-700 text-white" : "bg-slate-800 text-slate-300"}`}>Customers</Link>
          <Link href="/platform/orgs?demo=1" className={`rounded-md px-3 py-1.5 font-medium ${includeDemo ? "bg-brand-700 text-white" : "bg-slate-800 text-slate-300"}`}>Include demos</Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Organization</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Customers</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <Link href={`/platform/orgs/${o.id}`} className="font-medium text-slate-100 hover:text-brand-400">{o.name}</Link>
                  {o.isDemo ? <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">DEMO</span> : null}
                  <div className="text-xs text-slate-500">{o.slug}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{TIER_LABEL[o.packageTier] ?? o.packageTier}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.subscriptionStatus] ?? "bg-slate-700 text-slate-300"}`}>{o.subscriptionStatus.replace("_", " ")}</span></td>
                <td className="px-4 py-3 tabular-nums text-slate-300">{o._count.users}</td>
                <td className="px-4 py-3 tabular-nums text-slate-300">{o._count.customers}</td>
                <td className="px-4 py-3 text-slate-400">{fmt(o.createdAt)}</td>
              </tr>
            ))}
            {orgs.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No organizations.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
