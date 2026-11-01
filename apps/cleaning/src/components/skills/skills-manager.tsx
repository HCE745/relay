"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Skill = { id: string; name: string }
type WithSkills = { id: string; name: string; skillIds: string[] }
export type SkillMatrix = { skills: Skill[]; employees: WithSkills[]; sites: WithSkills[] }

export function SkillsManager({ matrix }: { matrix: SkillMatrix }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // ── Catalog ──
  const [newSkill, setNewSkill] = useState("")
  const [busy, setBusy] = useState(false)
  async function addSkill() {
    if (!newSkill.trim()) return
    setBusy(true)
    setError(null)
    const res = await apiSend("/api/skills", "POST", { name: newSkill })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setNewSkill("")
    router.refresh()
  }
  async function removeSkill(id: string) {
    if (!confirm("Deactivate this skill? It will be removed from employees and site requirements.")) return
    const res = await apiSend(`/api/skills/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Skill catalog</h3>
        {matrix.skills.length === 0 ? (
          <p className="text-sm text-slate-500">No skills yet. Add one below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {matrix.skills.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {s.name}
                <button onClick={() => removeSkill(s.id)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${s.name}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-end gap-3">
          <Field label="Add a skill" htmlFor="sk-new">
            <Input id="sk-new" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Floor stripping & waxing" />
          </Field>
          <Button onClick={addSkill} disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
      </Card>

      <AssignmentCard
        title="Employee skills"
        subtitle="Which skills each cleaner holds — used to match them to shifts."
        rows={matrix.employees}
        skills={matrix.skills}
        endpoint="/api/skills/assignments"
        idKey="userId"
        onSaved={() => router.refresh()}
        onError={setError}
      />

      <AssignmentCard
        title="Site skill requirements"
        subtitle="Skills a site needs; the coverage finder flags candidates who are missing them."
        rows={matrix.sites}
        skills={matrix.skills}
        endpoint="/api/skills/site-requirements"
        idKey="serviceLocationId"
        onSaved={() => router.refresh()}
        onError={setError}
      />
    </div>
  )
}

function AssignmentCard({
  title,
  subtitle,
  rows,
  skills,
  endpoint,
  idKey,
  onSaved,
  onError,
}: {
  title: string
  subtitle: string
  rows: WithSkills[]
  skills: Skill[]
  endpoint: string
  idKey: "userId" | "serviceLocationId"
  onSaved: () => void
  onError: (e: string | null) => void
}) {
  const [selectedId, setSelectedId] = useState<string>(rows[0]?.id ?? "")
  const selected = rows.find((r) => r.id === selectedId)
  const [checked, setChecked] = useState<Set<string>>(new Set(rows[0]?.skillIds ?? []))
  const [busy, setBusy] = useState(false)

  function pick(id: string) {
    setSelectedId(id)
    setChecked(new Set(rows.find((r) => r.id === id)?.skillIds ?? []))
    onError(null)
  }
  function toggle(skillId: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }
  async function save() {
    if (!selectedId) return
    setBusy(true)
    onError(null)
    const res = await apiSend(endpoint, "PATCH", { [idKey]: selectedId, skillIds: [...checked] })
    setBusy(false)
    if (!res.ok) return onError(res.error)
    onSaved()
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mb-4 text-xs text-slate-500">{subtitle}</p>
      {rows.length === 0 || skills.length === 0 ? (
        <p className="text-sm text-slate-500">{skills.length === 0 ? "Add skills to the catalog first." : "Nothing to assign yet."}</p>
      ) : (
        <>
          <Field label="Select" htmlFor={`sel-${idKey}`}>
            <Select id={`sel-${idKey}`} value={selectedId} onChange={(e) => pick(e.target.value)}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((s) => {
              const on = checked.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <Button onClick={save} disabled={busy || !selected}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
