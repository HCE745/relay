"use client"

import { useState } from "react"
import { apiSend } from "@/lib/client"

type Pref = { event: string; label: string; email: boolean; sms: boolean }

// Per-user notification channel preferences (Phase 21). Each user manages their
// own; used in admin settings and the field app. SMS requires the org to have
// the workforce.notifications capability + Twilio configured (handled server-side).
export function NotificationPrefs({ initial, smsAvailable }: { initial: Pref[]; smsAvailable: boolean }) {
  const [prefs, setPrefs] = useState(initial)
  const [savingEvent, setSavingEvent] = useState<string | null>(null)

  async function toggle(event: string, channel: "email" | "sms", value: boolean) {
    const next = prefs.map((p) => (p.event === event ? { ...p, [channel]: value } : p))
    setPrefs(next)
    const row = next.find((p) => p.event === event)!
    setSavingEvent(event)
    await apiSend("/api/notifications/preferences", "PATCH", { event, email: row.email, sms: row.sms })
    setSavingEvent(null)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Notify me when…</th>
            <th className="w-20 px-3 py-2 text-center font-medium">Email</th>
            <th className="w-20 px-3 py-2 text-center font-medium">Text</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {prefs.map((p) => (
            <tr key={p.event} className={savingEvent === p.event ? "opacity-60" : ""}>
              <td className="px-4 py-2.5 text-slate-700">{p.label}</td>
              <td className="px-3 py-2.5 text-center">
                <input type="checkbox" checked={p.email} onChange={(e) => toggle(p.event, "email", e.target.checked)} className="h-4 w-4 accent-brand-700" />
              </td>
              <td className="px-3 py-2.5 text-center">
                <input type="checkbox" checked={p.sms} disabled={!smsAvailable} onChange={(e) => toggle(p.event, "sms", e.target.checked)} className="h-4 w-4 accent-brand-700 disabled:opacity-40" title={smsAvailable ? undefined : "Text alerts aren't enabled for this account"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!smsAvailable ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Text alerts require the notifications add-on and a configured SMS sender. Email works today.</p>
      ) : (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Reply STOP to any text to opt out of SMS; START to opt back in.</p>
      )}
    </div>
  )
}
