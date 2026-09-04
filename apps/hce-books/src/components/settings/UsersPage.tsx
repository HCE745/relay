"use client"
import { useState } from "react"
import { UserPlus, Edit2, UserX, UserCheck, ChevronDown, ChevronUp, Shield } from "lucide-react"
import { toast } from "sonner"

type UserRow = {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  createdAt: string
  entityAccess: { entityId: string; entityName: string }[]
}

type Entity = { id: string; name: string }

const ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "BOOKKEEPER", "VIEWER"] as const
const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  ACCOUNTANT: "bg-green-100 text-green-700",
  BOOKKEEPER: "bg-yellow-100 text-yellow-700",
  VIEWER: "bg-gray-100 text-gray-600",
}
const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: "Full access — all entities, user management, settings",
  ADMIN: "Same as Owner — full access including user management",
  ACCOUNTANT: "Create/edit/post transactions, reconcile, reports, AI features",
  BOOKKEEPER: "Create/edit records (draft only) — cannot post or void",
  VIEWER: "Read-only access to reports and dashboards",
}

export function UsersPage({
  users: initialUsers,
  entities,
  currentUserId,
}: {
  users: UserRow[]
  entities: Entity[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [showInvite, setShowInvite] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // ─── Invite Form ────────────────────────────────────────────────────────────
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "VIEWER" as string,
    entityIds: [] as string[],
  })
  const [inviteResult, setInviteResult] = useState<{ tempPassword: string } | null>(null)
  const [inviting, setInviting] = useState(false)

  async function submitInvite() {
    if (!inviteForm.email) { toast.error("Email required"); return }
    setInviting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to create user"); return }
      setInviteResult({ tempPassword: data.tempPassword })
      setUsers((prev) => [...prev, {
        id: data.id,
        email: data.email,
        name: data.name ?? "",
        role: data.role,
        active: true,
        createdAt: new Date().toISOString(),
        entityAccess: (data.entityAccess as string[]).map((eid) => ({
          entityId: eid,
          entityName: entities.find((e) => e.id === eid)?.name ?? eid,
        })),
      }])
      setInviteForm({ email: "", name: "", role: "VIEWER", entityIds: [] })
    } finally { setInviting(false) }
  }

  // ─── Edit Form ──────────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState<{ role: string; entityIds: string[] }>({ role: "", entityIds: [] })

  function startEdit(u: UserRow) {
    setEditingId(u.id)
    setEditForm({ role: u.role, entityIds: u.entityAccess.map((a) => a.entityId) })
  }

  async function submitEdit(userId: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to update"); return }
      setUsers((prev) => prev.map((u) => u.id === userId ? {
        ...u, role: data.role,
        entityAccess: (data.entityAccess as string[]).map((eid) => ({
          entityId: eid, entityName: entities.find((e) => e.id === eid)?.name ?? eid,
        })),
      } : u))
      setEditingId(null)
      toast.success("User updated")
    } catch { toast.error("Network error") }
  }

  async function toggleActive(u: UserRow) {
    if (u.id === currentUserId) { toast.error("Cannot deactivate your own account"); return }
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed"); return }
      setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, active: !p.active } : p))
      toast.success(u.active ? "User deactivated" : "User reactivated")
    } catch { toast.error("Network error") }
  }

  function toggleEntityInvite(eid: string) {
    setInviteForm((f) => ({
      ...f,
      entityIds: f.entityIds.includes(eid) ? f.entityIds.filter((e) => e !== eid) : [...f.entityIds, eid],
    }))
  }

  function toggleEntityEdit(eid: string) {
    setEditForm((f) => ({
      ...f,
      entityIds: f.entityIds.includes(eid) ? f.entityIds.filter((e) => e !== eid) : [...f.entityIds, eid],
    }))
  }

  return (
    <div className="space-y-6">
      {/* ── Role reference ────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-800">Role permissions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <div key={r} className="flex items-start gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${ROLE_COLORS[r]}`}>{r}</span>
              <span className="text-xs text-blue-700">{ROLE_DESCRIPTIONS[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Users table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Team members ({users.length})</h2>
          <button
            onClick={() => { setShowInvite(!showInvite); setInviteResult(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite user
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 space-y-3">
            {inviteResult ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold text-green-800">User created successfully</p>
                <p className="text-sm text-green-700">
                  Share this temporary password with them — it won&apos;t be shown again:
                </p>
                <code className="block mt-1 px-3 py-2 bg-white border border-green-300 rounded text-sm font-mono text-green-900">
                  {inviteResult.tempPassword}
                </code>
                <button
                  onClick={() => { setShowInvite(false); setInviteResult(null) }}
                  className="mt-2 text-xs text-green-700 underline"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Full name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r} — {ROLE_DESCRIPTIONS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Entity access
                    <span className="font-normal text-gray-400 ml-1">(OWNER/ADMIN get all entities automatically)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {entities.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEntityInvite(e.id)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          inviteForm.entityIds.includes(e.id)
                            ? "bg-blue-100 border-blue-400 text-blue-800"
                            : "bg-white border-gray-300 text-gray-600 hover:border-blue-300"
                        }`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={submitInvite}
                    disabled={inviting}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviting ? "Creating..." : "Create user"}
                  </button>
                  <button
                    onClick={() => setShowInvite(false)}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Users list */}
        <div className="divide-y divide-gray-100">
          {users.map((u) => (
            <div key={u.id} className={`px-5 py-4 ${!u.active ? "opacity-50" : ""}`}>
              {editingId === u.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name || u.email}</p>
                      {u.name && <p className="text-xs text-gray-500">{u.email}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Entity access</label>
                      <div className="flex flex-wrap gap-1">
                        {entities.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => toggleEntityEdit(e.id)}
                            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                              editForm.entityIds.includes(e.id)
                                ? "bg-blue-100 border-blue-400 text-blue-800"
                                : "bg-white border-gray-300 text-gray-600 hover:border-blue-300"
                            }`}
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitEdit(u.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{u.name || u.email}</p>
                      {u.name && <p className="text-xs text-gray-500">{u.email}</p>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {u.role}
                      </span>
                      {!u.active && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Deactivated</span>}
                      {u.id === currentUserId && <span className="text-xs text-blue-500 font-medium">(you)</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {u.entityAccess.length === 0 ? (
                        <span className="text-xs text-gray-400">
                          {["OWNER", "ADMIN"].includes(u.role) ? "All entities (auto)" : "No entity access"}
                        </span>
                      ) : u.entityAccess.map((a) => (
                        <span key={a.entityId} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                          {a.entityName}
                        </span>
                      ))}
                    </div>
                  </div>
                  {u.id !== currentUserId && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.active
                            ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={u.active ? "Deactivate" : "Reactivate"}
                      >
                        {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
