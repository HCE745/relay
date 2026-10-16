"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type SiteOption = { id: string; name: string; customerName: string }
export type QrRow = {
  id: string
  label: string
  token: string
  isActive: boolean
  scanCount: number
  serviceLocation: { name: string; customer: { name: string } }
  _count: { issues: number }
}

export function QrCodesManager({ codes, sites, baseUrl }: { codes: QrRow[]; sites: SiteOption[]; baseUrl: string }) {
  const router = useRouter()
  const [serviceLocationId, setSite] = useState("")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!serviceLocationId) return setError("Choose a site")
    if (!label.trim()) return setError("Describe where it's posted")
    setBusy(true); setError(null)
    const res = await apiSend("/api/qr", "POST", { serviceLocationId, label })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setLabel(""); router.refresh()
  }

  async function toggle(c: QrRow) {
    const verb = c.isActive ? "Revoke" : "Reactivate"
    if (c.isActive && !confirm(`${verb} “${c.label}”? Anyone scanning this specific code will no longer be able to report. Other codes keep working.`)) return
    const res = await apiSend(`/api/qr/${c.id}`, "PATCH", { isActive: !c.isActive })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Create a QR code</h3>
        <p className="mb-4 text-xs text-slate-500">Post it where occupants can scan to report a problem: one per restroom, entrance, floor, etc.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Site" htmlFor="qr-site"><Select id="qr-site" value={serviceLocationId} onChange={(e) => { setSite(e.target.value); setError(null) }}><option value="">Choose a site…</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.customerName} · {s.name}</option>)}</Select></Field>
          <Field label="Where it's posted" htmlFor="qr-label"><Input id="qr-label" value={label} onChange={(e) => { setLabel(e.target.value); setError(null) }} placeholder="2nd floor men's restroom" /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create code"}</Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {codes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No QR codes yet. Create one above, then print and post it.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Label</th>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Scans</th>
                <th className="px-4 py-2.5 font-medium">Reports</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map((c) => (
                <tr key={c.id} className={c.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.label}</td>
                  <td className="px-4 py-3 text-slate-600">{c.serviceLocation.customer.name} · {c.serviceLocation.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.scanCount}</td>
                  <td className="px-4 py-3 text-slate-500">{c._count.issues}</td>
                  <td className="px-4 py-3">{c.isActive ? <span className="text-emerald-600">Active</span> : <span className="text-red-500">Revoked</span>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.isActive ? <Link href={`/issues/qr/${c.id}/print`} target="_blank" className="mr-3 text-sm font-medium text-brand hover:underline">Print</Link> : null}
                    <button onClick={() => toggle(c)} className={`text-sm font-medium ${c.isActive ? "text-red-600" : "text-brand"} hover:underline`}>{c.isActive ? "Revoke" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-slate-400">Public link format: {baseUrl}/r/&lt;code&gt;. Revoking one code never affects the others. No reprinting the whole building.</p>
    </div>
  )
}
