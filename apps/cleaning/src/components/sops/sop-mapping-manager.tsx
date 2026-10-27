"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type SopOpt = { id: string; title: string }
type Mapping = { id: string; issueCategory: string; sop: { id: string; title: string } }
const CATEGORIES = ["QUALITY", "SAFETY", "EQUIPMENT", "SUPPLIES", "ACCESS", "CUSTOMER", "OTHER"]
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

// Admin-configured lookup (no inference): an issue category surfaces these SOPs.
export function SopMappingManager({ mappings, sops }: { mappings: Mapping[]; sops: SopOpt[] }) {
  const router = useRouter()
  const [category, setCategory] = useState("SAFETY")
  const [sopId, setSopId] = useState(sops[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!sopId) return setError("Choose an SOP")
    setBusy(true); setError(null)
    const res = await apiSend("/api/sops/mappings", "POST", { issueCategory: category, sopId })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function remove(m: Mapping) {
    const res = await apiSend("/api/sops/mappings", "DELETE", { issueCategory: m.issueCategory, sopId: m.sop.id })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Map an issue category to an SOP</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Issue category" htmlFor="m-cat"><Select id="m-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleize(c)}</option>)}</Select></Field>
          <Field label="Shows this SOP" htmlFor="m-sop"><Select id="m-sop" value={sopId} onChange={(e) => setSopId(e.target.value)}>{sops.length === 0 ? <option value="">No published SOPs</option> : sops.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
          <Button onClick={add} disabled={busy || !sopId}>Add mapping</Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {mappings.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No mappings yet. A mapped SOP appears inline on issues of that category.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5 font-medium">Issue category</th><th className="px-4 py-2.5 font-medium">SOP</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{titleize(m.issueCategory)}</td>
                  <td className="px-4 py-3 text-slate-600">{m.sop.title}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => remove(m)} className="text-sm font-medium text-red-600 hover:underline">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
