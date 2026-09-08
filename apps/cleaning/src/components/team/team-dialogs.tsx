"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type TeamUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  isActive: boolean
  employeeCode: string | null
  payType: string | null
  payRate: string | null
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  CLEANER: "Cleaner",
}

function RoleSelect({ roles, value, onChange }: { roles: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r] ?? r}
        </option>
      ))}
    </Select>
  )
}

export function NewUserButton({ roles }: { roles: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({
    name: "",
    email: "",
    phone: "",
    role: roles.includes("CLEANER") ? "CLEANER" : roles[0] ?? "CLEANER",
    password: "",
    employeeCode: "",
    payRate: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload: Record<string, unknown> = {
      name: v.name,
      email: v.email,
      phone: v.phone || undefined,
      role: v.role,
      password: v.password,
      employeeCode: v.employeeCode || undefined,
    }
    if (v.payRate) payload.payRate = Number(v.payRate)
    const res = await apiSend("/api/team", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setV({ ...v, name: "", email: "", phone: "", password: "", employeeCode: "", payRate: "" })
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add employee</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add employee">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" htmlFor="u-name">
              <Input id="u-name" required value={v.name} onChange={set("name")} />
            </Field>
            <Field label="Role" htmlFor="u-role">
              <RoleSelect roles={roles} value={v.role} onChange={(role) => setV({ ...v, role })} />
            </Field>
            <Field label="Email" htmlFor="u-email">
              <Input id="u-email" type="email" required value={v.email} onChange={set("email")} />
            </Field>
            <Field label="Phone" htmlFor="u-phone">
              <Input id="u-phone" value={v.phone} onChange={set("phone")} />
            </Field>
            <Field label="Employee code" htmlFor="u-code" hint="For payroll export">
              <Input id="u-code" value={v.employeeCode} onChange={set("employeeCode")} />
            </Field>
            <Field label="Pay rate ($/hr)" htmlFor="u-rate">
              <Input id="u-rate" type="number" min={0} step="0.01" value={v.payRate} onChange={set("payRate")} />
            </Field>
          </div>
          <Field label="Temporary password" htmlFor="u-pass" hint="Share with the employee; they can change it after signing in.">
            <Input id="u-pass" type="text" required minLength={8} value={v.password} onChange={set("password")} />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create employee"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function UserRowActions({ user, roles, canManage }: { user: TeamUser; roles: string[]; canManage: boolean }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<"edit" | "password" | null>(null)
  const [busy, setBusy] = useState(false)

  async function toggleActive() {
    setBusy(true)
    await apiSend(`/api/team/${user.id}`, "PATCH", { isActive: !user.isActive })
    setBusy(false)
    router.refresh()
  }

  if (!canManage) return null
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => setDialog("edit")}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDialog("password")}>
        Password
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={toggleActive}>
        {user.isActive ? "Deactivate" : "Reactivate"}
      </Button>

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title={`Edit ${user.name}`}>
        <EditUserForm user={user} roles={roles} onDone={() => setDialog(null)} />
      </Modal>
      <Modal open={dialog === "password"} onClose={() => setDialog(null)} title={`Set password for ${user.name}`}>
        <SetPasswordForm userId={user.id} onDone={() => setDialog(null)} />
      </Modal>
    </div>
  )
}

function EditUserForm({ user, roles, onDone }: { user: TeamUser; roles: string[]; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState({
    name: user.name,
    phone: user.phone ?? "",
    role: user.role,
    employeeCode: user.employeeCode ?? "",
    payRate: user.payRate ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const roleOptions = roles.includes(user.role) ? roles : [user.role, ...roles]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload: Record<string, unknown> = {
      name: v.name,
      phone: v.phone || undefined,
      role: v.role,
      employeeCode: v.employeeCode || undefined,
    }
    if (v.payRate) payload.payRate = Number(v.payRate)
    const res = await apiSend(`/api/team/${user.id}`, "PATCH", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="e-name">
          <Input id="e-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Role" htmlFor="e-role">
          <RoleSelect roles={roleOptions} value={v.role} onChange={(role) => setV({ ...v, role })} />
        </Field>
        <Field label="Phone" htmlFor="e-phone">
          <Input id="e-phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
        <Field label="Employee code" htmlFor="e-code">
          <Input id="e-code" value={v.employeeCode} onChange={(e) => setV({ ...v, employeeCode: e.target.value })} />
        </Field>
        <Field label="Pay rate ($/hr)" htmlFor="e-rate">
          <Input id="e-rate" type="number" min={0} step="0.01" value={v.payRate} onChange={(e) => setV({ ...v, payRate: e.target.value })} />
        </Field>
      </div>
      <p className="text-xs text-slate-400">Email cannot be changed here. Use “Password” to issue a new credential.</p>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}

function SetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/team/${userId}/password`, "POST", { password })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New temporary password" htmlFor="p-new" hint="Share it with the employee; they can change it after signing in.">
        <Input id="p-new" type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {done ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated.</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {done ? "Close" : "Cancel"}
        </Button>
        {!done ? (
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Set password"}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
