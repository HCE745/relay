"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Start an inspection on a completed job: pick a template → create → open runner.
export function InspectButton({ jobId, templates }: { jobId: string; templates: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!templateId) return setError("Choose a template")
    setBusy(true)
    setError(null)
    const res = await apiSend<{ id: string }>(`/api/jobs/${jobId}/inspections`, "POST", { templateId })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.push(`/inspections/${res.data.id}`)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Inspect work</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Start inspection">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-600">No inspection templates yet. Create one under Inspections first.</p>
        ) : (
          <div className="space-y-4">
            <Field label="Template" htmlFor="i-tpl">
              <Select id="i-tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={start} disabled={busy}>
                {busy ? "Starting…" : "Start inspection"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
