"use client"

import { useState } from "react"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"

const CATEGORIES: { value: string; label: string }[] = [
  { value: "OTHER", label: "Something else" },
  { value: "SUPPLIES", label: "Out of supplies (soap, towels, paper)" },
  { value: "QUALITY", label: "Cleanliness / needs attention" },
  { value: "SAFETY", label: "Safety hazard" },
  { value: "ACCESS", label: "Access / door / lock" },
]

export function QrReportForm({ token }: { token: string }) {
  const [category, setCategory] = useState("OTHER")
  const [description, setDescription] = useState("")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [busy, setBusy] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!description.trim()) return setError("Please describe the problem.")
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/public/qr/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, description, reporterName: name, reporterContact: contact, website }),
      })
      const data = await res.json().catch(() => null)
      setBusy(false)
      if (!res.ok) return setError((data && data.error) || "Something went wrong. Please try again.")
      setReference(data?.reference ?? "RECEIVED")
    } catch {
      setBusy(false); setError("Network error. Please try again.")
    }
  }

  if (reference) {
    return (
      <div className="text-center">
        <p className="text-base font-semibold text-emerald-700">Thanks, we&apos;ve got it.</p>
        <p className="mt-2 text-sm text-slate-600">Reference <span className="font-mono font-semibold">{reference}</span></p>
        <p className="mt-1 text-xs text-slate-400">The cleaning team has been notified.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Field label="What's the problem?" htmlFor="qr-cat">
        <Select id="qr-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label="Tell us more" htmlFor="qr-desc">
        <Textarea id="qr-desc" value={description} onChange={(e) => { setDescription(e.target.value); setError(null) }} placeholder="e.g. The soap dispenser by the sink is empty." rows={4} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Your name (optional)" htmlFor="qr-name"><Input id="qr-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone or email (optional)" htmlFor="qr-contact" hint="only if you'd like a follow-up"><Input id="qr-contact" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
      </div>
      {/* Honeypot: visually hidden, real users never fill it. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
