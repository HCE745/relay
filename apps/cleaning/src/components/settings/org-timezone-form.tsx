"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { listTimezones } from "@/lib/scheduling/timezones"

export function OrgTimezoneForm({ current }: { current: string }) {
  const router = useRouter()
  const zones = listTimezones()
  const [tz, setTz] = useState(current)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { timezone: tz })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Field label="Organization timezone" htmlFor="org-tz" hint="Default for all sites; each site can override it.">
        <Select
          id="org-tz"
          value={tz}
          onChange={(e) => {
            setTz(e.target.value)
            setSaved(false)
          }}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || tz === current}>
          {busy ? "Saving…" : "Save timezone"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
