import { listActiveDemos } from "@/lib/data/platform"

export const dynamic = "force-dynamic"

const fmt = (d: Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const hoursLeft = (d: Date) => Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 3_600_000))

export default async function PlatformDemosPage() {
  const demos = await listActiveDemos()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Active demos ({demos.length})</h1>
        <p className="mt-0.5 text-sm text-slate-400">Public sandbox workspaces. Each is isolated, capped, and auto-purged after 24 hours by the <code className="text-slate-300">purge-demo</code> cron.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2.5 font-medium">Workspace</th><th className="px-4 py-2.5 font-medium">Created</th><th className="px-4 py-2.5 font-medium">Expires</th><th className="px-4 py-2.5 font-medium">TTL left</th><th className="px-4 py-2.5 font-medium">Users</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {demos.map((d) => (
              <tr key={d.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3 text-slate-200">{d.slug}</td>
                <td className="px-4 py-3 text-slate-400">{fmt(d.createdAt)}</td>
                <td className="px-4 py-3 text-slate-400">{fmt(d.demoExpiresAt!)}</td>
                <td className="px-4 py-3 text-slate-300">{hoursLeft(d.demoExpiresAt!)}h</td>
                <td className="px-4 py-3 tabular-nums text-slate-300">{d._count.users}</td>
              </tr>
            ))}
            {demos.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No active demos.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
