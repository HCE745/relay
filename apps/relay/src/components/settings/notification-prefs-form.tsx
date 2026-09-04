"use client"

import { useState } from "react"
import { toast } from "@/lib/toast"
import { Loader2, BellOff } from "lucide-react"

interface EventPrefs {
  inApp: boolean
  email: boolean
}

interface NotifPrefs {
  pauseAllEmail: boolean
  events: {
    issueAssigned: EventPrefs
    issueEscalated: EventPrefs
    commentAdded: EventPrefs
    issueResolved: EventPrefs
    systemAlerts: EventPrefs
  }
}

const EVENT_LABELS: { key: keyof NotifPrefs["events"]; label: string; description: string }[] = [
  { key: "issueAssigned",  label: "Issue assigned to me",  description: "When an issue is assigned or re-assigned to you" },
  { key: "issueEscalated", label: "Issue escalated",        description: "When one of your issues gets escalated" },
  { key: "commentAdded",   label: "New comment",            description: "When someone comments on an issue you're involved with" },
  { key: "issueResolved",  label: "Issue resolved",         description: "When an issue you reported or own is closed" },
  { key: "systemAlerts",   label: "System alerts",          description: "Account, billing, and security notifications" },
]

const DEFAULT_PREFS: NotifPrefs = {
  pauseAllEmail: false,
  events: {
    issueAssigned:  { inApp: true, email: true },
    issueEscalated: { inApp: true, email: true },
    commentAdded:   { inApp: true, email: true },
    issueResolved:  { inApp: true, email: false },
    systemAlerts:   { inApp: true, email: true },
  },
}

function parsePrefs(raw: unknown): NotifPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS
  const r = raw as Record<string, unknown>
  return {
    pauseAllEmail: typeof r.pauseAllEmail === "boolean" ? r.pauseAllEmail : false,
    events: {
      issueAssigned:  parseEvent((r.events as Record<string, unknown>)?.issueAssigned),
      issueEscalated: parseEvent((r.events as Record<string, unknown>)?.issueEscalated),
      commentAdded:   parseEvent((r.events as Record<string, unknown>)?.commentAdded),
      issueResolved:  parseEvent((r.events as Record<string, unknown>)?.issueResolved),
      systemAlerts:   parseEvent((r.events as Record<string, unknown>)?.systemAlerts),
    },
  }
}

function parseEvent(raw: unknown): EventPrefs {
  if (!raw || typeof raw !== "object") return { inApp: true, email: true }
  const r = raw as Record<string, unknown>
  return {
    inApp: typeof r.inApp === "boolean" ? r.inApp : true,
    email: typeof r.email === "boolean" ? r.email : true,
  }
}

interface Props {
  initialPrefs: unknown
}

export function NotificationPrefsForm({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => parsePrefs(initialPrefs))
  const [saving, setSaving] = useState(false)

  function setEvent(key: keyof NotifPrefs["events"], field: keyof EventPrefs, value: boolean) {
    setPrefs(p => ({
      ...p,
      events: { ...p.events, [key]: { ...p.events[key], [field]: value } },
    }))
  }

  async function save(updated: NotifPrefs) {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      if (res.ok) toast.success("Notification preferences saved")
      else toast.error("Failed to save preferences")
    } catch {
      toast.error("Connection error")
    } finally {
      setSaving(false)
    }
  }

  function toggle(updater: (p: NotifPrefs) => NotifPrefs) {
    setPrefs(prev => {
      const next = updater(prev)
      save(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Master pause */}
      <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BellOff className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-900">Pause all email notifications</p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-6">
            Mutes email delivery — in-app notifications still appear
          </p>
        </div>
        <button
          role="switch"
          aria-checked={prefs.pauseAllEmail}
          onClick={() => toggle(p => ({ ...p, pauseAllEmail: !p.pauseAllEmail }))}
          className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors mt-0.5 ${
            prefs.pauseAllEmail ? "bg-orange-500" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              prefs.pauseAllEmail ? "translate-x-5" : ""
            }`}
          />
        </button>
      </label>

      {/* Per-event table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 border-b border-gray-200">
          <div className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Event</div>
          <div className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-16">In-app</div>
          <div className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-16">Email</div>
        </div>
        <div className="divide-y divide-gray-100">
          {EVENT_LABELS.map(({ key, label, description }) => (
            <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center">
              <div className="px-4 py-3">
                <p className="text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              {/* In-app toggle */}
              <div className="px-3 flex justify-center w-16">
                <button
                  role="switch"
                  aria-checked={prefs.events[key].inApp}
                  onClick={() => toggle(p => { setEvent(key, "inApp", !p.events[key].inApp); return { ...p, events: { ...p.events, [key]: { ...p.events[key], inApp: !p.events[key].inApp } } } })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${prefs.events[key].inApp ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs.events[key].inApp ? "translate-x-4" : ""}`} />
                </button>
              </div>
              {/* Email toggle */}
              <div className="px-3 flex justify-center w-16">
                <button
                  role="switch"
                  aria-checked={prefs.events[key].email}
                  disabled={prefs.pauseAllEmail}
                  onClick={() => toggle(p => ({ ...p, events: { ...p.events, [key]: { ...p.events[key], email: !p.events[key].email } } }))}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    prefs.pauseAllEmail ? "opacity-40 cursor-not-allowed bg-gray-200" :
                    prefs.events[key].email ? "bg-blue-500" : "bg-gray-200"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs.events[key].email && !prefs.pauseAllEmail ? "translate-x-4" : ""}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving…
        </div>
      )}
    </div>
  )
}
