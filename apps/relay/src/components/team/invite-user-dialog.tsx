"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Copy, CheckCircle, Mail } from "lucide-react"
import { USER_ROLE } from "@/lib/constants"

interface EmployeeType {
  id: string
  name: string
  description: string | null
  baseRole: string
}

interface Props {
  departments: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string; role: string }>
  sessionUser: { role: string; canInvite: boolean; departmentId: string | null }
  employeeTypes?: EmployeeType[]
  children: React.ReactNode
}

const INVITABLE_ROLES: Record<string, string[]> = {
  ADMIN: ["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE", "HR", "VENDOR"],
  HR:    ["MANAGER", "SUPERVISOR", "EMPLOYEE", "HR", "VENDOR"],
  _delegated: ["SUPERVISOR", "EMPLOYEE"],
}

export function InviteUserDialog({ departments, locations, users, sessionUser, employeeTypes = [], children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ inviteUrl: string; emailSent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedRole, setSelectedRole] = useState("EMPLOYEE")

  const isAdminLevel = ["ADMIN", "HR"].includes(sessionUser.role)
  const roleKey = sessionUser.role === "ADMIN" ? "ADMIN" : sessionUser.role === "HR" ? "HR" : "_delegated"
  const allowedRoles = INVITABLE_ROLES[roleKey] ?? INVITABLE_ROLES._delegated

  function handleClose() {
    setOpen(false)
    setResult(null)
    setError("")
    setCopied(false)
    setSelectedRole("EMPLOYEE")
    if (result) router.refresh()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const body: Record<string, string | undefined> = {}
    formData.forEach((v, k) => { if (v !== "") body[k] = v.toString() })
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setResult(data)
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to send invite")
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Invite Team Member</h3>
              <button onClick={handleClose}><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {result ? (
              <div className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                  <h4 className="font-semibold text-gray-900 mb-1">Invite sent!</h4>
                  {result.emailSent ? (
                    <p className="text-sm text-gray-500">An invitation email has been sent. Share the link below as a backup.</p>
                  ) : (
                    <p className="text-sm text-gray-500">Email delivery not configured — share this link directly with the new team member:</p>
                  )}
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-600 truncate flex-1">{result.inviteUrl}</span>
                  <button
                    onClick={() => copyLink(result.inviteUrl)}
                    className="shrink-0 p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                    title="Copy link"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

                {/* Employee Type picker — auto-sets role */}
                {isAdminLevel && employeeTypes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee Type</label>
                    <select
                      onChange={e => {
                        const t = employeeTypes.find(et => et.id === e.target.value)
                        if (t && allowedRoles.includes(t.baseRole)) setSelectedRole(t.baseRole)
                      }}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Select type (optional) —</option>
                      {employeeTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Choosing a type auto-fills the role below.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="new.employee@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <select
                      name="role"
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {allowedRoles.map(r => (
                        <option key={r} value={r}>{USER_ROLE[r as keyof typeof USER_ROLE] ?? r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                    <select
                      name="locationId"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">None</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                    {isAdminLevel ? (
                      <select
                        name="departmentId"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">None</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    ) : (
                      <>
                        <input name="departmentId" type="hidden" value={sessionUser.departmentId ?? ""} />
                        <input
                          disabled
                          value={departments.find(d => d.id === sessionUser.departmentId)?.name ?? "Your department"}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Reports to</label>
                    <select
                      name="managerId"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">None</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {loading ? "Sending…" : "Send Invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
