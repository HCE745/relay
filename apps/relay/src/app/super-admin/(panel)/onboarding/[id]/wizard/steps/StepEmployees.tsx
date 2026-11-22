"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, UserCheck, Mail, Clock } from "lucide-react"

type User = {
  id:          string
  name:        string
  email:       string
  role:        string
  department:  { id: string; name: string } | null
  location:    { id: string; name: string } | null
  createdAt:   string
  lastLoginAt: string | null
}

type Invitation = {
  id:         string
  email:      string
  role:       string
  expiresAt:  string
  createdAt:  string
  department: { id: string; name: string } | null
  location:   { id: string; name: string } | null
}

type UsersData = {
  users:               User[]
  invitations:         Invitation[]
  primaryContactEmail: string
}

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

export function StepEmployees({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [data, setData]       = useState<UsersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<"users" | "invitations">("users")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/users`)
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json() as UsersData
      setData(json)
      json.users.length >= 1 ? onReady() : onNotReady()
    } catch {
      setError("Failed to load employee data.")
    } finally {
      setLoading(false)
    }
  }, [onboardingId, onReady, onNotReady])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
  }

  if (!data) return null

  const { users, invitations, primaryContactEmail } = data

  return (
    <div className="space-y-4">
      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-4 py-3">
        <p className="text-xs text-indigo-300">
          <span className="font-semibold">Read-only view.</span> This step shows users and pending invitations already in this
          organization. The primary contact will invite additional team members after they accept their own invitation.
          No emails will be sent from this wizard.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("users")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === "users"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Active Users ({users.length})
        </button>
        <button
          onClick={() => setTab("invitations")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === "invitations"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Pending Invitations ({invitations.length})
        </button>
      </div>

      {tab === "users" && (
        users.length > 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">User</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden md:table-cell">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                        <div>
                          <p className="text-white font-medium text-sm">{u.name}</p>
                          <p className="text-gray-500 text-xs">{u.email}</p>
                        </div>
                        {u.email === primaryContactEmail && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/60 text-indigo-300 border border-indigo-800/50">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                      {u.department?.name ?? <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center">
            <UserCheck className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active users yet.</p>
            <p className="text-xs text-gray-600 mt-1">
              Users will appear here once the primary contact accepts their invitation and sets up the organization.
            </p>
          </div>
        )
      )}

      {tab === "invitations" && (
        invitations.length > 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden md:table-cell">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invitations.map(inv => {
                  const expiry   = new Date(inv.expiresAt)
                  const isExpiring = expiry.getTime() - Date.now() < 86_400_000 * 2
                  return (
                    <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                          <span className="text-white text-sm">{inv.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isExpiring ? "text-amber-500" : "text-gray-600"}`} />
                          <span className={`text-xs ${isExpiring ? "text-amber-400" : "text-gray-500"}`}>
                            {expiry.toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center">
            <Mail className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No pending invitations.</p>
            <p className="text-xs text-gray-600 mt-1">
              Employee invitations will be managed by the organization admin after onboarding is complete.
            </p>
          </div>
        )
      )}

      {!isPostLaunch && users.length === 0 && invitations.length === 0 && (
        <p className="text-xs text-gray-600">
          This step will mark as complete once the primary contact has accepted their invitation and activated their account.
        </p>
      )}
    </div>
  )
}
