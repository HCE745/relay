"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type PacketRow = {
  id: string
  name: string
  description: string | null
  assignOnHire: boolean
  isActive: boolean
  itemCount: number
  assignmentCount: number
}
type Employee = { id: string; name: string }
type ItemForm = { label: string; requiresDocument: boolean }

const blankItem = (): ItemForm => ({ label: "", requiresDocument: false })

export function OnboardingManager({ packets, employees }: { packets: PacketRow[]; employees: Employee[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // ── Packet create ──
  const [name, setName] = useState("")
  const [assignOnHire, setAssignOnHire] = useState(false)
  const [items, setItems] = useState<ItemForm[]>([blankItem()])
  const [busy, setBusy] = useState(false)

  const setItem = (i: number, patch: Partial<ItemForm>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addItem = () => setItems((xs) => [...xs, blankItem()])
  const removeItem = (i: number) => setItems((xs) => (xs.length === 1 ? xs : xs.filter((_, j) => j !== i)))

  async function createPacket() {
    const clean = items.map((it) => ({ label: it.label.trim(), requiresDocument: it.requiresDocument })).filter((it) => it.label)
    if (!name.trim()) return setError("Name the packet")
    if (clean.length === 0) return setError("Add at least one item")
    setBusy(true)
    setError(null)
    const res = await apiSend("/api/onboarding/packets", "POST", { name, assignOnHire, items: clean })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setName("")
    setAssignOnHire(false)
    setItems([blankItem()])
    router.refresh()
  }
  async function toggleOnHire(p: PacketRow) {
    const res = await apiSend(`/api/onboarding/packets/${p.id}`, "PATCH", { assignOnHire: !p.assignOnHire })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this packet? Existing assignments keep their tasks.")) return
    const res = await apiSend(`/api/onboarding/packets/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  // ── Assign ──
  const [assignPacketId, setAssignPacketId] = useState(packets[0]?.id ?? "")
  const [assignUserId, setAssignUserId] = useState(employees[0]?.id ?? "")
  const [assigning, setAssigning] = useState(false)
  async function assign() {
    if (!assignPacketId || !assignUserId) return setError("Pick a packet and an employee")
    setAssigning(true)
    setError(null)
    const res = await apiSend("/api/onboarding/assignments", "POST", { packetId: assignPacketId, userId: assignUserId })
    setAssigning(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  const activePackets = packets.filter((p) => p.isActive)

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="overflow-x-auto">
        {packets.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No onboarding packets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Packet</th>
                <th className="px-4 py-2.5 text-right font-medium">Items</th>
                <th className="px-4 py-2.5 text-right font-medium">Assigned</th>
                <th className="px-4 py-2.5 font-medium">On hire</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packets.map((p) => (
                <tr key={p.id} className={p.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.name}
                    {!p.isActive ? " (inactive)" : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.itemCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.assignmentCount}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleOnHire(p)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.assignOnHire ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.assignOnHire ? "Auto on hire" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.isActive ? (
                      <button onClick={() => deactivate(p.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Deactivate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">New packet</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="ob-name">
            <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New cleaner onboarding" />
          </Field>
          <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={assignOnHire} onChange={(e) => setAssignOnHire(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Automatically assign to new hires
          </label>
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Checklist items</div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="e.g. Sign employee handbook" />
                <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={it.requiresDocument} onChange={(e) => setItem(i, { requiresDocument: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                  needs doc
                </label>
                <button type="button" onClick={() => removeItem(i)} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Remove item">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-2 text-sm font-medium text-brand hover:underline">
            + Add item
          </button>
        </div>
        <div className="mt-4">
          <Button onClick={createPacket} disabled={busy}>
            {busy ? "Creating…" : "Create packet"}
          </Button>
        </div>
      </Card>

      {activePackets.length > 0 && employees.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Assign a packet</h3>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Packet" htmlFor="ob-ap">
              <Select id="ob-ap" value={assignPacketId} onChange={(e) => setAssignPacketId(e.target.value)}>
                {activePackets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employee" htmlFor="ob-au">
              <Select id="ob-au" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={assign} disabled={assigning}>
              {assigning ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
