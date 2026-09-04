"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNowStrict } from "date-fns"
import { Loader2 } from "lucide-react"

const ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE", "VENDOR"]

const ROLE_COLOR: Record<string, string> = {
  ADMIN:      "bg-purple-900/50 text-purple-300 border-purple-700",
  MANAGER:    "bg-blue-900/50 text-blue-300 border-blue-700",
  SUPERVISOR: "bg-indigo-900/50 text-indigo-300 border-indigo-700",
  HR:         "bg-pink-900/50 text-pink-300 border-pink-700",
  EMPLOYEE:   "bg-gray-800 text-gray-400 border-gray-700",
  VENDOR:     "bg-orange-900/50 text-orange-300 border-orange-700",
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: Date
  lastLoginAt: Date | null
}

function UserRow({ orgId, user }: { orgId: string; user: User }) {
  const router          = useRouter()
  const [role, setRole] = useState(user.role)
  const [active, setActive] = useState(user.isActive)
  const [saving, setSaving] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>, key: string) {
    setSaving(key)
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      router.refresh()
    } finally {
      setSaving(null)
    }
  }

  async function handleRoleChange(newRole: string) {
    setRole(newRole)
    await patch({ role: newRole }, "role")
  }

  async function handleToggleActive() {
    const next = !active
    setActive(next)
    await patch({ isActive: next }, "active")
  }

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-5 py-3 text-white text-sm font-medium">{user.name}</td>
      <td className="px-5 py-3 text-gray-400 text-sm">{user.email}</td>
      <td className="px-5 py-3">
        <div className="relative flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[role] ?? ROLE_COLOR.EMPLOYEE}`}>
            {role}
          </span>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={!!saving}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            aria-label="Change role"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {saving === "role" && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
        </div>
      </td>
      <td className="px-5 py-3 text-gray-400 text-sm">
        {format(new Date(user.createdAt), "MMM d, yyyy")}
      </td>
      <td className="px-5 py-3 text-gray-500 text-xs">
        {user.lastLoginAt ? formatDistanceToNowStrict(new Date(user.lastLoginAt), { addSuffix: true }) : "Never"}
      </td>
      <td className="px-5 py-3">
        <button
          onClick={handleToggleActive}
          disabled={!!saving}
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
            active
              ? "bg-green-900/40 text-green-400 hover:bg-red-950/60 hover:text-red-400"
              : "bg-gray-800 text-gray-500 hover:bg-green-950/60 hover:text-green-400"
          }`}
        >
          {saving === "active" ? <Loader2 className="w-3 h-3 animate-spin inline" /> : active ? "Active" : "Inactive"}
        </button>
      </td>
    </tr>
  )
}

export function UserTable({ orgId, users }: { orgId: string; users: User[] }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-white font-semibold">Users ({users.length})</h2>
        <p className="text-gray-500 text-xs mt-0.5">Click a role badge to change it. Click the status pill to toggle.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-800">
              {["Name", "Email", "Role", "Joined", "Last Login", "Status"].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map((user) => (
              <UserRow key={user.id} orgId={orgId} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
