"use client"

import { useState } from "react"
import { SERVICE_FREQUENCIES, PROPERTY_TYPES } from "@/lib/zod-schemas"

const FREQ_LABEL: Record<string, string> = { ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Not sure yet" }

export function BookingForm({ slug, orgName }: { slug: string; orgName: string }) {
  const [v, setV] = useState({ contactName: "", contactEmail: "", contactPhone: "", addressLine1: "", city: "", state: "", postalCode: "", propertyType: "RESIDENTIAL", sqft: "", frequency: "WEEKLY", notes: "", website: "" })
  const [state, setState] = useState<"form" | "done" | "out_of_area">("form")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await fetch(`/api/public/${slug}/quote`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...v, sqft: v.sqft ? Number(v.sqft) : undefined }),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(data?.error ?? "Something went wrong. Please try again.")
    if (data?.accepted === false && data?.reason === "out_of_area") return setState("out_of_area")
    setState("done")
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-900">Thanks — we got your request!</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">A member of the {orgName} team will reach out shortly to confirm details and provide a quote.</p>
      </div>
    )
  }
  if (state === "out_of_area") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-amber-900">We don&apos;t currently service this area</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-amber-800">Unfortunately your address falls outside our current service area. Please check back as we expand.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Honeypot — hidden from humans; bots fill it and are dropped. */}
      <div className="absolute left-[-9999px]" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} /></label></div>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Your name *</span><input required value={v.contactName} onChange={set("contactName")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Phone</span><input value={v.contactPhone} onChange={set("contactPhone")} inputMode="tel" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Email</span><input value={v.contactEmail} onChange={set("contactEmail")} inputMode="email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      </div>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Address</span><input value={v.addressLine1} onChange={set("addressLine1")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">City</span><input value={v.city} onChange={set("city")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">State</span><input value={v.state} onChange={set("state")} maxLength={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">ZIP</span><input value={v.postalCode} onChange={set("postalCode")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Property</span><select value={v.propertyType} onChange={set("propertyType")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base">{PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p === "RESIDENTIAL" ? "Home" : "Business"}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">How often?</span><select value={v.frequency} onChange={set("frequency")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base">{SERVICE_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}</select></label>
      </div>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Anything else?</span><textarea value={v.notes} onChange={set("notes")} className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy || !v.contactName} className="w-full rounded-xl bg-brand-700 py-3 text-base font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Request a quote"}</button>
    </form>
  )
}
