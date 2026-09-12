"use client"

import { useState, useEffect } from "react"
import {
  Users, Plus, X, Check, Loader2, AlertCircle,
  ShieldCheck, UserCircle, Power, PowerOff, KeyRound, Trash2,
} from "lucide-react"

interface SalesUser {
  id:        string
  email:     string
  name:      string
  role:      "admin_sales" | "sales_rep"
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

const ROLE_LABEL: Record<string, string> = {
  admin_sales: "Sales Manager",
  sales_rep:   "Sales Rep",
}
const ROLE_COLOR: Record<string, string> = {
  admin_sales: "bg-indigo-900/50 text-indigo-300 border border-indigo-700",
  sales_rep:   "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
}

function Badge({ role }: { role: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[role] ?? "bg-gray-800 text-gray-400"}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

interface CreateFormProps {
  onCreated: (u: SalesUser) => void
  onCancel:  () => void
}

function CreateForm({ onCreated, onCancel }: CreateFormProps) {
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [role,     setRole]     = useState<"sales_rep" | "admin_sales">("sales_rep")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/super-admin/sales-users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, password, role }),
      })
      const j = await res.json() as SalesUser & { error?: string }
      if (!res.ok) throw new Error(j.error ?? "Failed to create user")
      onCreated(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-semibold">New Sales User</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="jane@company.com"
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as "sales_rep" | "admin_sales")}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="sales_rep">Sales Rep</option>
              <option value="admin_sales">Sales Manager</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Creating…" : "Create User"}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

interface ResetPasswordModalProps {
  user:      SalesUser
  onDone:    () => void
  onCancel:  () => void
}

function ResetPasswordModal({ user, onDone, onCancel }: ResetPasswordModalProps) {
  const [password, setPassword] = useState("")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/super-admin/sales-users/${user.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "reset_password", password }),
      })
      const j = await res.json() as { error?: string }
      if (!res.ok) throw new Error(j.error ?? "Failed to reset password")
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
        <h3 className="text-white font-semibold mb-1">Reset Password</h3>
        <p className="text-sm text-gray-400 mb-5">Set a new password for <span className="text-white">{user.name}</span></p>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Set Password"}
            </button>
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SalesUsersPage() {
  const [users,       setUsers]       = useState<SalesUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [resetTarget, setResetTarget] = useState<SalesUser | null>(null)
  const [actionId,    setActionId]    = useState<string | null>(null)
  const [toast,       setToast]       = useState("")

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  useEffect(() => {
    fetch("/api/super-admin/sales-users")
      .then(r => r.json())
      .then((d: SalesUser[]) => { setUsers(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleActive(user: SalesUser) {
    setActionId(user.id)
    try {
      const action = user.isActive ? "deactivate" : "reactivate"
      const res = await fetch(`/api/super-admin/sales-users/${user.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      })
      const updated = await res.json() as SalesUser
      if (res.ok) {
        setUsers(us => us.map(u => u.id === user.id ? updated : u))
        showToast(`${updated.name} ${updated.isActive ? "reactivated" : "deactivated"}`)
      }
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          <Check className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onDone={() => { setResetTarget(null); showToast("Password reset") }}
          onCancel={() => setResetTarget(null)}
        />
      )}

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Sales Users</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Manage who can access the{" "}
          <a href="/sales" target="_blank" className="text-emerald-400 hover:underline">/sales</a>{" "}
          dashboard. Sales reps log in with their own credentials at <code className="text-gray-300">/sales/login</code>.
        </p>
      </div>

      {showCreate && (
        <CreateForm
          onCreated={u => { setUsers(us => [u, ...us]); setShowCreate(false); showToast(`${u.name} created`) }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors mb-6"
        >
          <Plus className="w-4 h-4" />
          Add Sales User
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
          <UserCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No sales users yet</p>
          <p className="text-gray-600 text-sm mt-1">Add reps and managers to give them access to the sales panel.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-800/60 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-900/40"} hover:bg-gray-800/40 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-800 flex items-center justify-center shrink-0">
                        <span className="text-emerald-400 text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.name}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Reset password */}
                      <button
                        onClick={() => setResetTarget(u)}
                        title="Reset password"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-900/20 transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {/* Toggle active */}
                      <button
                        onClick={() => void toggleActive(u)}
                        disabled={actionId === u.id}
                        title={u.isActive ? "Deactivate" : "Reactivate"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? "text-gray-500 hover:text-red-400 hover:bg-red-900/20"
                            : "text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/20"
                        }`}
                      >
                        {actionId === u.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : u.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 flex items-start gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-400">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p><span className="text-white font-medium">Sales Managers</span> (admin_sales) — full read/write access to all CRM data in the sales panel.</p>
          <p><span className="text-white font-medium">Sales Reps</span> (sales_rep) — same panel access today; Phase 2 will scope their view to assigned accounts only.</p>
          <p className="text-gray-600">Sales users cannot access <code>/super-admin</code> routes. SuperAdmin credentials continue to work at <code>/sales/login</code> as before.</p>
        </div>
      </div>
    </div>
  )
}
