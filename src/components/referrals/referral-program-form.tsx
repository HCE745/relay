"use client"

import { useState } from "react"
import { Save, Loader2 } from "lucide-react"

interface ProgramData {
  id?: string
  name: string
  isActive: boolean
  cardTitle: string
  cardDescription: string
  programDescription: string
  termsText: string
  ctaLabel: string
  linkBaseUrl: string
  consecutiveMonthsRequired: number
  requireNewCustomer: boolean
  allowDuringTrial: boolean
  allowSelfReferral: boolean
  allowRelatedOrgs: boolean
  pauseOnFailedPayment: boolean
  resetClockOnCancellation: boolean
  maxRewardsPerOrg: number | null
  maxRewardsPerYear: number | null
  referrerRewardValue: number
  referrerRewardCycles: number
  referredRewardValue: number
  referredRewardCycles: number
  showOnDashboard: boolean
  showInMobileApp: boolean
  qualificationExplanation: string
  successMessage: string
  pendingRewardMessage: string
  disqualificationMessage: string
}

const DEFAULTS: ProgramData = {
  name: "Standard Referral Program",
  isActive: true,
  cardTitle: "Earn Free Months",
  cardDescription: "Refer a business and earn a free month when they stay on a paid plan.",
  programDescription: "",
  termsText: "",
  ctaLabel: "Copy Referral Link",
  linkBaseUrl: "https://app.getrelay.software/signup?ref=",
  consecutiveMonthsRequired: 6,
  requireNewCustomer: true,
  allowDuringTrial: true,
  allowSelfReferral: false,
  allowRelatedOrgs: false,
  pauseOnFailedPayment: true,
  resetClockOnCancellation: true,
  maxRewardsPerOrg: null,
  maxRewardsPerYear: null,
  referrerRewardValue: 100,
  referrerRewardCycles: 1,
  referredRewardValue: 100,
  referredRewardCycles: 1,
  showOnDashboard: true,
  showInMobileApp: true,
  qualificationExplanation: "",
  successMessage: "",
  pendingRewardMessage: "",
  disqualificationMessage: "",
}

export function ReferralProgramForm({ existing }: { existing: ProgramData | null }) {
  const [form, setForm]   = useState<ProgramData>(existing ?? DEFAULTS)
  const [busy, setBusy]   = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ProgramData>(key: K, value: ProgramData[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const url    = "/api/super-admin/referral-program"
      const method = form.id ? "PATCH" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Failed to save")
      }
      setSaved(true)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setBusy(false)
    }
  }

  const inp = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
  const lbl = "text-xs font-medium text-gray-400 mb-1 block"
  const chk = "w-4 h-4 accent-indigo-600"

  function CheckRow({ label, k }: { label: string; k: keyof ProgramData }) {
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" className={chk} checked={form[k] as boolean}
          onChange={e => set(k, e.target.checked as never)} />
        <span className="text-sm text-gray-300">{label}</span>
      </label>
    )
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 pb-2 border-b border-gray-800">{title}</h3>
        <div className="space-y-4">{children}</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Program name (internal)</label>
            <input className={inp} value={form.name} onChange={e => set("name", e.target.value)} required />
          </div>
          <div className="flex items-end pb-1">
            <CheckRow label="Active (show to customers)" k="isActive" />
          </div>
        </div>
      </Section>

      <Section title="Customer-facing copy">
        <div>
          <label className={lbl}>Card title</label>
          <input className={inp} value={form.cardTitle} onChange={e => set("cardTitle", e.target.value)} placeholder="Earn Free Months" />
        </div>
        <div>
          <label className={lbl}>Card description (shown under title)</label>
          <input className={inp} value={form.cardDescription} onChange={e => set("cardDescription", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Full program description (shown on /referrals page)</label>
          <textarea className={inp} rows={3} value={form.programDescription} onChange={e => set("programDescription", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Terms text</label>
          <textarea className={inp} rows={2} value={form.termsText} onChange={e => set("termsText", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>CTA button label</label>
            <input className={inp} value={form.ctaLabel} onChange={e => set("ctaLabel", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Referral link base URL</label>
            <input className={inp} value={form.linkBaseUrl} onChange={e => set("linkBaseUrl", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={lbl}>Qualification explanation (shown to customer)</label>
          <input className={inp} value={form.qualificationExplanation} onChange={e => set("qualificationExplanation", e.target.value)} placeholder="e.g. Stay on a paid plan for 6 consecutive months" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Success message</label>
            <input className={inp} value={form.successMessage} onChange={e => set("successMessage", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Pending reward message</label>
            <input className={inp} value={form.pendingRewardMessage} onChange={e => set("pendingRewardMessage", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Disqualification message</label>
            <input className={inp} value={form.disqualificationMessage} onChange={e => set("disqualificationMessage", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Qualification rules">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>Consecutive months required</label>
            <input type="number" min={1} max={36} className={inp} value={form.consecutiveMonthsRequired}
              onChange={e => set("consecutiveMonthsRequired", Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Max rewards / org (blank = unlimited)</label>
            <input type="number" min={1} className={inp} value={form.maxRewardsPerOrg ?? ""}
              onChange={e => set("maxRewardsPerOrg", e.target.value ? Number(e.target.value) : null)}
              placeholder="Unlimited" />
          </div>
          <div>
            <label className={lbl}>Max rewards / org / year (blank = unlimited)</label>
            <input type="number" min={1} className={inp} value={form.maxRewardsPerYear ?? ""}
              onChange={e => set("maxRewardsPerYear", e.target.value ? Number(e.target.value) : null)}
              placeholder="Unlimited" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CheckRow label="Require new customer"       k="requireNewCustomer" />
          <CheckRow label="Allow during trial"         k="allowDuringTrial" />
          <CheckRow label="Allow self-referral"        k="allowSelfReferral" />
          <CheckRow label="Allow related orgs"         k="allowRelatedOrgs" />
          <CheckRow label="Pause on failed payment"    k="pauseOnFailedPayment" />
          <CheckRow label="Reset clock on cancellation" k="resetClockOnCancellation" />
        </div>
      </Section>

      <Section title="Rewards — Referrer (the org that shared the link)">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Discount value ($)</label>
            <input type="number" min={0} className={inp} value={form.referrerRewardValue}
              onChange={e => set("referrerRewardValue", Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Billing cycles</label>
            <input type="number" min={1} className={inp} value={form.referrerRewardCycles}
              onChange={e => set("referrerRewardCycles", Number(e.target.value))} />
          </div>
        </div>
      </Section>

      <Section title="Rewards — Referred (the new org that signed up)">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Discount value ($)</label>
            <input type="number" min={0} className={inp} value={form.referredRewardValue}
              onChange={e => set("referredRewardValue", Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Billing cycles</label>
            <input type="number" min={1} className={inp} value={form.referredRewardCycles}
              onChange={e => set("referredRewardCycles", Number(e.target.value))} />
          </div>
        </div>
      </Section>

      <Section title="Visibility">
        <div className="flex gap-6 flex-wrap">
          <CheckRow label="Show on dashboard card" k="showOnDashboard" />
          <CheckRow label="Show in mobile app"     k="showInMobileApp" />
        </div>
      </Section>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="pt-2">
        <button type="submit" disabled={busy}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : busy ? "Saving…" : form.id ? "Update Program" : "Create Program"}
        </button>
      </div>

    </form>
  )
}
