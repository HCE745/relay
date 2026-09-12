"use client"

import { useState, useEffect } from "react"
import { Loader2, Users, Info, Shield } from "lucide-react"

type SalesUser = {
  id: string
  name: string
  email: string
  role: string
}

type AuthInfo = {
  superAdmin?: boolean
  salesUserId?: string
  salesUserRole?: string
}

export default function TeamSettingsPage() {
  const [auth, setAuth]         = useState<AuthInfo | null>(null)
  const [users, setUsers]       = useState<SalesUser[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const authRes = await fetch("/api/sales/auth")
        const authData: AuthInfo = authRes.ok ? await authRes.json() : {}
        setAuth(authData)

        const isManager = authData.superAdmin || authData.salesUserRole === "admin_sales"
        if (isManager) {
          const usersRes = await fetch("/api/super-admin/sales-users")
          if (usersRes.ok) {
            const data = await usersRes.json()
            setUsers(Array.isArray(data) ? data : data.users ?? [])
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isManager = auth?.superAdmin || auth?.salesUserRole === "admin_sales"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Team Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Team transfer and permission configuration</p>
      </div>

      {/* Transfer policy info card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-300">Transfer Permissions</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
            <p>Sales reps create transfer requests, which managers must approve before ownership changes hands.</p>
          </div>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
            <p>Managers and Super Admins can transfer records directly without requiring approval.</p>
          </div>
        </div>
      </div>

      {isManager ? (
        /* Team member list */
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">Sales Team</h2>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {users.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">No sales users found</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      u.role === "admin_sales"
                        ? "bg-blue-900/40 text-blue-300"
                        : "bg-gray-800 text-gray-400"
                    }`}>
                      {u.role === "admin_sales" ? "Manager" : "Rep"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            To add or remove team members, visit <a href="/super-admin/sales" className="text-emerald-600 hover:text-emerald-400">Super Admin → Sales</a>.
          </p>
        </div>
      ) : (
        /* Rep view */
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Contact your manager to update team settings.</p>
        </div>
      )}
    </div>
  )
}
