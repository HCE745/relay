"use client"

import { useState, useTransition } from "react"
import { toast } from "@/lib/toast"
import { AlarmClock } from "lucide-react"

const ROLE_OPTIONS = ["ADMIN", "MANAGER", "SUPERVISOR", "HR"]

interface EscalationConfig {
  enabled: boolean
  delayMinutes: number
  recipients: {
    roles: string[]
    userIds: string[]
  }
}

interface Props {
  initialConfig: EscalationConfig | null
}

function defaultConfig(): EscalationConfig {
  return { enabled: false, delayMinutes: 15, recipients: { roles: ["ADMIN", "MANAGER"], userIds: [] } }
}

export function AckEscalationClient({ initialConfig }: Props) {
  const [config, setConfig] = useState<EscalationConfig>(initialConfig ?? defaultConfig())
  const [pending, startTransition] = useTransition()

  async function save(next: EscalationConfig) {
    const res = await fetch("/api/settings/ack-escalation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    if (res.ok) {
      toast.success("Escalation settings saved")
    } else {
      toast.error("Failed to save escalation settings")
    }
  }

  function update(patch: Partial<EscalationConfig>) {
    const next = { ...config, ...patch }
    setConfig(next)
    startTransition(() => { void save(next) })
  }

  function toggleRole(role: string) {
    const cur = config.recipients.roles
    const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]
    update({ recipients: { ...config.recipients, roles: next } })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <AlarmClock className="w-4 h-4 text-orange-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-900">Acknowledgment Escalation</p>
          <p className="text-xs text-gray-500">Notify additional people when CRITICAL/HIGH issues go unacknowledged.</p>
        </div>
        <button
          onClick={() => update({ enabled: !config.enabled })}
          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${config.enabled ? "bg-orange-500" : "bg-gray-200"}`}
          role="switch"
          aria-checked={config.enabled}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? "translate-x-4" : ""}`} />
        </button>
      </div>

      {config.enabled && (
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 whitespace-nowrap">Escalate after</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={config.delayMinutes}
              onChange={e => update({ delayMinutes: parseInt(e.target.value) || 15 })}
              onBlur={() => save(config)}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
            />
            <span className="text-sm text-gray-500">minutes without acknowledgment</span>
          </div>
          <p className="text-xs text-gray-400">
            The cron runs every minute, so actual delay may vary by up to ±1 minute.
          </p>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notify these roles</h4>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    config.recipients.roles.includes(role)
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pending && <p className="px-4 pb-3 text-xs text-gray-400">Saving…</p>}
    </div>
  )
}
