"use client"

import { useState } from "react"
import { Check } from "lucide-react"

interface Props {
  purchaseRequestEnabled: boolean
  purchaseRequestItemLimit: number | null
  purchaseRequestMonthlyLimit: number | null
  injuryAlertEmails: string[]
}

export function SafetySettingsForm({
  purchaseRequestEnabled: initialEnabled,
  purchaseRequestItemLimit: initialItemLimit,
  purchaseRequestMonthlyLimit: initialMonthlyLimit,
  injuryAlertEmails: initialEmails,
}: Props) {
  const [enabled, setEnabled]         = useState(initialEnabled)
  const [itemLimit, setItemLimit]     = useState(initialItemLimit?.toString() ?? "")
  const [monthlyLimit, setMonthlyLimit] = useState(initialMonthlyLimit?.toString() ?? "")
  const [alertEmails, setAlertEmails] = useState(initialEmails.join(", "))
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState("")

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false)
    const emails = alertEmails
      .split(",")
      .map(e => e.trim())
      .filter(e => e.length > 0)

    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseRequestEnabled:     enabled,
        purchaseRequestItemLimit:   itemLimit || null,
        purchaseRequestMonthlyLimit: monthlyLimit || null,
        injuryAlertEmails:          emails,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to save")
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-5">
      {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      {/* Purchase requests */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-800">Purchase Requests</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm text-gray-700">Enable purchase request submissions</p>
            <p className="text-xs text-gray-400">Employees can submit requests for damaged/missing items with AI verification</p>
          </div>
        </label>

        {enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-7">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Per-item limit ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemLimit}
                onChange={e => setItemLimit(e.target.value)}
                className={inputCls}
                placeholder="No limit"
              />
              <p className="text-xs text-gray-400 mt-1">Requests above this amount require manual approval</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monthly limit per user ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
                className={inputCls}
                placeholder="No limit"
              />
              <p className="text-xs text-gray-400 mt-1">Total approved spend per user per month</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-800">Injury Report Alerts</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Alert email addresses</label>
          <input
            value={alertEmails}
            onChange={e => setAlertEmails(e.target.value)}
            className={inputCls}
            placeholder="safety@company.com, hr@company.com"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated. These addresses receive an email when any injury report is submitted. Admins and managers are always notified in-app.</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  )
}
