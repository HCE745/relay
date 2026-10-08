"use client"

import { useState } from "react"

export function ApplyForm({ slug, orgName, postings }: { slug: string; orgName: string; postings: { id: string; title: string }[] }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", jobPostingId: postings[0]?.id ?? "", appliedFor: "", availability: "", resumeRef: "", website: "" })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await fetch(`/api/public/${slug}/apply`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: v.name, email: v.email || undefined, phone: v.phone || undefined,
        jobPostingId: postings.length ? v.jobPostingId : undefined,
        appliedFor: postings.length ? undefined : (v.appliedFor || undefined),
        availability: v.availability || undefined, resumeRef: v.resumeRef || undefined, website: v.website,
      }),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(data?.error ?? "Something went wrong. Please try again.")
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-900">Thanks for applying!</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">The {orgName} hiring team will review your application and reach out if there&apos;s a fit.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Honeypot — hidden from humans; bots fill it and are dropped. */}
      <div className="absolute left-[-9999px]" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} /></label></div>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Your name *</span><input required value={v.name} onChange={set("name")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Phone</span><input value={v.phone} onChange={set("phone")} inputMode="tel" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Email</span><input value={v.email} onChange={set("email")} inputMode="email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      </div>
      {postings.length ? (
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Position</span><select value={v.jobPostingId} onChange={set("jobPostingId")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base">{postings.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      ) : (
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Position you&apos;re interested in</span><input value={v.appliedFor} onChange={set("appliedFor")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      )}
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Availability</span><input value={v.availability} onChange={set("availability")} placeholder="e.g. weekdays, mornings" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Resume link (optional)</span><input value={v.resumeRef} onChange={set("resumeRef")} placeholder="https://…" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></label>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy || !v.name} className="w-full rounded-xl bg-brand-700 py-3 text-base font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Submit application"}</button>
    </form>
  )
}
