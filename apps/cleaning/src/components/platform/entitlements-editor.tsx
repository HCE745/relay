"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

type Row = { cap: string; inTier: boolean; added: boolean; removed: boolean; effective: boolean }

// Platform-admin capability-override editor. Per-org grants/revokes on top of the
// Stripe tier — billing is untouched.
export function EntitlementsEditor({ orgId, rows }: { orgId: string; rows: Row[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function set(capability: string, mode: "add" | "remove" | "default") {
    setBusy(capability); setError(null)
    const res = await apiSend(`/api/platform/orgs/${orgId}/entitlements`, "PATCH", { capability, mode })
    setBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2 font-medium">Capability</th><th className="px-3 py-2 font-medium">In plan</th><th className="px-3 py-2 font-medium">Effective</th><th className="px-3 py-2 font-medium">Override</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.cap} className="hover:bg-slate-900/50">
                <td className="px-3 py-1.5 font-mono text-xs text-slate-300">{r.cap}</td>
                <td className="px-3 py-1.5">{r.inTier ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}</td>
                <td className="px-3 py-1.5">{r.effective ? <span className="text-emerald-400">on</span> : <span className="text-slate-500">off</span>}{r.added ? <span className="ml-1 text-[10px] text-sky-400">+granted</span> : null}{r.removed ? <span className="ml-1 text-[10px] text-amber-400">−revoked</span> : null}</td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-1">
                    {!r.inTier ? <button onClick={() => set(r.cap, r.added ? "default" : "add")} disabled={busy === r.cap} className={`rounded px-2 py-0.5 text-xs ${r.added ? "bg-sky-500/20 text-sky-300" : "bg-slate-800 text-slate-300"}`}>{r.added ? "granted" : "grant"}</button> : null}
                    {r.inTier || r.added ? <button onClick={() => set(r.cap, r.removed ? "default" : "remove")} disabled={busy === r.cap} className={`rounded px-2 py-0.5 text-xs ${r.removed ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-300"}`}>{r.removed ? "revoked" : "revoke"}</button> : null}
                    {(r.added || r.removed) ? <button onClick={() => set(r.cap, "default")} disabled={busy === r.cap} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:text-slate-300">reset</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
