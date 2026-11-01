"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type KioskRow = {
  id: string
  name: string
  siteName: string | null
  serviceLocationId: string | null
  pinRequired: boolean
  photoRequired: boolean
  isActive: boolean
  lastSeenAt: Date | string | null
}
export type PinRow = { id: string; name: string; hasPin: boolean }
type Site = { id: string; name: string }

export function KiosksManager({ kiosks, sites, pins }: { kiosks: KioskRow[]; sites: Site[]; pins: PinRow[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<{ id: string; token: string } | null>(null)

  // Create
  const [name, setName] = useState("")
  const [siteId, setSiteId] = useState("")
  const [pinReq, setPinReq] = useState(true)
  const [photoReq, setPhotoReq] = useState(false)
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) return setError("Name the kiosk")
    setBusy(true)
    setError(null)
    const res = await apiSend<{ id: string; token: string }>("/api/kiosks", "POST", {
      name,
      serviceLocationId: siteId || null,
      pinRequired: pinReq,
      photoRequired: photoReq,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setToken({ id: res.data!.id, token: res.data!.token })
    setName("")
    setSiteId("")
    router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this kiosk? Its device will stop working immediately.")) return
    const res = await apiSend(`/api/kiosks/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function regenerate(id: string) {
    if (!confirm("Rotate this kiosk's token? The current device will be logged out.")) return
    const res = await apiSend<{ token: string }>(`/api/kiosks/${id}/token`, "POST")
    if (!res.ok) return setError(res.error)
    setToken({ id, token: res.data!.token })
  }
  async function toggle(k: KioskRow, field: "pinRequired" | "photoRequired") {
    const res = await apiSend(`/api/kiosks/${k.id}`, "PATCH", { [field]: !k[field] })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  async function setPin(u: PinRow) {
    const pin = prompt(`Set a 4–8 digit clock PIN for ${u.name} (blank to cancel):`)
    if (!pin) return
    const res = await apiSend("/api/kiosks/pins", "PATCH", { userId: u.id, pin })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function clearPin(u: PinRow) {
    if (!confirm(`Clear ${u.name}'s clock PIN?`)) return
    const res = await apiSend("/api/kiosks/pins", "PATCH", { userId: u.id, pin: null })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {token ? (
        <Card className="border-emerald-200 bg-emerald-50/60 p-4 text-sm">
          <p className="font-medium text-emerald-900">Device activation token (shown once — copy it now):</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs text-slate-800">
              {token.id}:{token.token}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(`${token.id}:${token.token}`).catch(() => {})}
              className="text-xs font-medium text-brand hover:underline"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            On the kiosk device, open <span className="font-mono">/kiosk</span> and paste this to activate. It is not
            retrievable later — rotate the token if lost.
          </p>
          <button onClick={() => setToken(null)} className="mt-2 text-xs text-slate-400 hover:underline">
            Dismiss
          </button>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        {kiosks.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No kiosks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kiosk</th>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Verification</th>
                <th className="px-4 py-2.5 font-medium">Last seen</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kiosks.map((k) => (
                <tr key={k.id} className={k.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {k.name}
                    {!k.isActive ? " (inactive)" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{k.siteName ?? "Office / general"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => toggle(k, "pinRequired")} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${k.pinRequired ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500"}`}>
                        PIN {k.pinRequired ? "on" : "off"}
                      </button>
                      <button onClick={() => toggle(k, "photoRequired")} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${k.photoRequired ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500"}`}>
                        Photo {k.photoRequired ? "on" : "off"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{k.lastSeenAt ? new Date(k.lastSeenAt).toLocaleString() : "never"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => regenerate(k.id)} className="mr-3 text-sm font-medium text-brand hover:underline">
                      Rotate token
                    </button>
                    {k.isActive ? (
                      <button onClick={() => deactivate(k.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Deactivate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Register a kiosk</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="k-name">
            <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Front desk tablet" />
          </Field>
          <Field label="Site (optional)" htmlFor="k-site">
            <Select id="k-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Office / general</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={pinReq} onChange={(e) => setPinReq(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Require a PIN
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={photoReq} onChange={(e) => setPhotoReq(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Require a photo
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Register kiosk"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Employee clock PINs</h3>
        <p className="mb-4 text-xs text-slate-500">A PIN identifies the employee at a shared kiosk. It is hashed and never shown.</p>
        <div className="divide-y divide-slate-100">
          {pins.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-800">
                {u.name} {u.hasPin ? <StatusBadge tone="success">PIN set</StatusBadge> : <StatusBadge tone="neutral">no PIN</StatusBadge>}
              </span>
              <span className="flex gap-3">
                <button onClick={() => setPin(u)} className="font-medium text-brand hover:underline">
                  {u.hasPin ? "Reset" : "Set"} PIN
                </button>
                {u.hasPin ? (
                  <button onClick={() => clearPin(u)} className="font-medium text-red-600 hover:underline">
                    Clear
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
