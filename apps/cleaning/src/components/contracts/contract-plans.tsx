"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type LinkablePlan = {
  id: string
  name: string
  contractId: string | null
  serviceLocation: { name: string } | null
}

// Optional linking: choose which of the customer's service plans belong to this
// contract. Linking is purely an association — it never changes how invoicing
// runs. Unchecking a plan detaches it; a plan already on another contract shows
// a note and, if picked, moves here.
export function ContractPlansEditor({ contractId, plans }: { contractId: string; plans: LinkablePlan[] }) {
  const router = useRouter()
  const initial = useMemo(() => new Set(plans.filter((p) => p.contractId === contractId).map((p) => p.id)), [plans, contractId])
  const [selected, setSelected] = useState<Set<string>>(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = selected.size !== initial.size || [...selected].some((id) => !initial.has(id))

  function toggle(id: string) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    const res = await apiSend(`/api/contracts/${contractId}/plans`, "PATCH", { planIds: [...selected] })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true)
    router.refresh()
  }

  if (plans.length === 0) {
    return <p className="text-sm text-slate-500">This customer has no service plans yet. Plans can be linked once they exist.</p>
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {plans.map((p) => {
          const checked = selected.has(p.id)
          const elsewhere = p.contractId != null && p.contractId !== contractId
          return (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                id={`plan-${p.id}`}
                checked={checked}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor={`plan-${p.id}`} className="flex-1 cursor-pointer text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>
                {p.serviceLocation ? <span className="text-slate-500"> · {p.serviceLocation.name}</span> : null}
                {elsewhere && !checked ? <span className="ml-2 text-xs text-amber-600">on another contract</span> : null}
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save linked plans"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
