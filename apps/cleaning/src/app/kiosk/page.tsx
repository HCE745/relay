"use client"

import { useEffect, useState, useCallback } from "react"

// Shared time-clock kiosk device page (Phase 49). PUBLIC — authenticated by the
// device activation token (stored locally after activation), never a staff
// session. Each punch calls the token-guarded API, which clocks the employee
// in/out through the normal per-user path and audits it.

type RosterMember = { id: string; name: string; clockedIn: boolean; hasPin: boolean }
type KioskInfo = { id: string; name: string; pinRequired: boolean; photoRequired: boolean }
const STORAGE_KEY = "kiosk_cred"

function readCred(): { kioskId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const i = raw.indexOf(":")
    if (i < 0) return null
    return { kioskId: raw.slice(0, i), token: raw.slice(i + 1) }
  } catch {
    return null
  }
}

export default function KioskPage() {
  const [cred, setCred] = useState<{ kioskId: string; token: string } | null>(null)
  const [kiosk, setKiosk] = useState<KioskInfo | null>(null)
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [activation, setActivation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RosterMember | null>(null)
  const [pin, setPin] = useState("")
  const [photoRef, setPhotoRef] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
  }

  const loadSession = useCallback(async (c: { kioskId: string; token: string }) => {
    const res = await post("/api/kiosk/session", c)
    if (!res.ok) {
      setError(res.data?.error ?? "This kiosk is not recognized. Re-activate it.")
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
      setCred(null)
      setKiosk(null)
      return
    }
    setError(null)
    setKiosk(res.data.kiosk)
    setRoster(res.data.roster)
  }, [])

  useEffect(() => {
    const c = readCred()
    if (c) {
      setCred(c)
      loadSession(c)
    }
  }, [loadSession])

  function activate() {
    const raw = activation.trim()
    const i = raw.indexOf(":")
    if (i < 0) return setError("Paste the full activation code (id:token)")
    const c = { kioskId: raw.slice(0, i), token: raw.slice(i + 1) }
    try {
      localStorage.setItem(STORAGE_KEY, raw)
    } catch {}
    setCred(c)
    setActivation("")
    loadSession(c)
  }

  function open(member: RosterMember) {
    setSelected(member)
    setPin("")
    setPhotoRef(null)
    setError(null)
  }

  async function punch() {
    if (!selected || !cred || !kiosk) return
    if (kiosk.pinRequired && !pin.trim()) return setError("Enter the PIN")
    if (kiosk.photoRequired && !photoRef) return setError("Capture a photo first")
    setBusy(true)
    setError(null)
    const res = await post("/api/kiosk/punch", { ...cred, userId: selected.id, pin: pin || undefined, photoRef: photoRef || undefined })
    setBusy(false)
    if (!res.ok) return setError(res.data?.error ?? "Could not record the punch")
    setRoster(res.data.roster)
    setFlash(`${res.data.userName} clocked ${res.data.action === "in" ? "IN" : "OUT"}`)
    setSelected(null)
    setTimeout(() => setFlash(null), 3500)
  }

  if (!cred || !kiosk) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold text-slate-900">Activate kiosk</h1>
        <p className="text-sm text-slate-500">Paste the activation code from Time-clock kiosks (format id:token).</p>
        <input
          value={activation}
          onChange={(e) => setActivation(e.target.value)}
          placeholder="kiosk id:token"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button onClick={activate} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white">
          Activate
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{kiosk.name}</h1>
          <p className="text-sm text-slate-500">Tap your name to clock in or out.</p>
        </div>
        <span className="text-xs text-slate-400">
          {kiosk.pinRequired ? "PIN required" : ""} {kiosk.photoRequired ? "· photo required" : ""}
        </span>
      </div>

      {flash ? <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{flash}</div> : null}
      {error && !selected ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {roster.map((m) => (
          <button
            key={m.id}
            onClick={() => open(m)}
            className={`rounded-xl border p-4 text-left ${m.clockedIn ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"} hover:border-brand`}
          >
            <div className="font-medium text-slate-900">{m.name}</div>
            <div className="mt-1 text-xs text-slate-500">
              {m.clockedIn ? "Clocked in — tap to clock out" : "Tap to clock in"}
              {!m.hasPin && kiosk.pinRequired ? " · no PIN set" : ""}
            </div>
          </button>
        ))}
        {roster.length === 0 ? <p className="text-sm text-slate-500">No staff available.</p> : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">
              {selected.clockedIn ? "Clock out" : "Clock in"} — {selected.name}
            </h2>
            {kiosk.pinRequired ? (
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoFocus
                placeholder="PIN"
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest"
              />
            ) : null}
            {kiosk.photoRequired ? (
              <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600">
                {photoRef ? "Photo captured ✓" : "Capture photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => setPhotoRef(e.target.files?.[0] ? `kiosk-photo-${Date.now()}-${e.target.files[0].name}` : null)}
                />
              </label>
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600">
                Cancel
              </button>
              <button onClick={punch} disabled={busy} className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {busy ? "…" : selected.clockedIn ? "Clock out" : "Clock in"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
