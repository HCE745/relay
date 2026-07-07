"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { KeyRound, X, ChevronDown, UserCog, ToggleLeft, ToggleRight, UserCheck, Pencil, MapPin } from "lucide-react"
import { PeoplePicker } from "@/components/ui/people-picker"

interface OrgUser {
  id: string
  name: string
  role: string
  email?: string
  department?: string
  location?: string
}

interface OrgLocation {
  id: string
  name: string
}

interface Props {
  userId: string
  userName: string
  userRole: string
  sessionRole: string
  canInvite: boolean
  canChangeEmail: boolean
  currentManagerId: string | null
  orgUsers: OrgUser[]
  orgLocations?: OrgLocation[]
  assignedLocationIds?: string[]
}

type Modal = "password" | "manager" | "permissions" | "editName" | "locations" | null

export function TeamActions({
  userId,
  userName,
  userRole,
  sessionRole,
  canInvite,
  canChangeEmail,
  currentManagerId,
  orgUsers,
  orgLocations = [],
  assignedLocationIds = [],
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [password, setPassword] = useState("")
  const [editedName, setEditedName] = useState(userName)
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set(assignedLocationIds))
  const [managerId, setManagerId] = useState(currentManagerId ?? "")
  const [localCanInvite, setLocalCanInvite] = useState(canInvite)
  const [localCanChangeEmail, setLocalCanChangeEmail] = useState(canChangeEmail)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close dropdown on scroll or resize
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close) }
  }, [open])

  const isAdmin = sessionRole === "ADMIN"
  const isAdminLevel = ["ADMIN", "HR"].includes(sessionRole)
  const canResetPassword = isAdminLevel && (isAdmin || userRole !== "ADMIN")
  const canGrantInvite = isAdmin && ["MANAGER", "SUPERVISOR"].includes(userRole)

  function openModal(m: Modal) { setModal(m); setOpen(false); setMessage(null) }
  function closeModal() { setModal(null); setPassword(""); setMessage(null) }

  async function handleResetPassword() {
    if (password.length < 8) { setMessage({ type: "err", text: "Must be at least 8 characters" }); return }
    setSaving(true); setMessage(null)
    try {
      const res = await fetch(`/api/team/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      })
      const data = await res.json()
      if (res.ok) { setMessage({ type: "ok", text: "Password reset." }); setPassword("") }
      else setMessage({ type: "err", text: data.error ?? "Failed" })
    } catch {
      toast.error("Connection error — please check your internet and try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSetManager() {
    setSaving(true); setMessage(null)
    try {
      const res = await fetch(`/api/team/${userId}/manager`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: managerId || null }),
      })
      if (res.ok) {
        setMessage({ type: "ok", text: "Manager updated." })
        router.refresh()
      } else {
        const data = await res.json()
        setMessage({ type: "err", text: data.error ?? "Failed" })
      }
    } catch {
      toast.error("Connection error — please check your internet and try again.")
    } finally {
      setSaving(false)
    }
  }

  async function togglePermission(field: "canInvite" | "canChangeEmail", value: boolean) {
    setSaving(true); setMessage(null)
    try {
      const res = await fetch(`/api/team/${userId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        if (field === "canInvite") setLocalCanInvite(value)
        if (field === "canChangeEmail") setLocalCanChangeEmail(value)
        router.refresh()
      } else {
        const data = await res.json()
        setMessage({ type: "err", text: data.error ?? "Failed" })
      }
    } catch {
      toast.error("Connection error — please check your internet and try again.")
    } finally {
      setSaving(false)
    }
  }

  // Selectable managers: everyone except self and subordinates (to prevent cycles)
  const eligibleManagers = orgUsers.filter(u => u.id !== userId)

  function handleTriggerClick() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  return (
    <>
      {/* Dropdown trigger */}
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        Manage
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Portal dropdown — escapes overflow:hidden containers */}
      {open && dropPos && createPortal(
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div
            style={{ position: "fixed", top: dropPos.top, right: dropPos.right }}
            className="z-[90] w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 text-sm"
          >
            {isAdmin && (
              <button
                onClick={() => openModal("editName")}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-gray-50 text-gray-700"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-400" />
                Edit Name
              </button>
            )}
            {isAdmin && orgLocations.length > 0 && (
              <button
                onClick={() => { setSelectedLocations(new Set(assignedLocationIds)); openModal("locations") }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-gray-50 text-gray-700"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                Assign Locations
              </button>
            )}
            {canResetPassword && (
              <button
                onClick={() => openModal("password")}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-gray-50 text-gray-700"
              >
                <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                Reset Password
              </button>
            )}
            <button
              onClick={() => openModal("manager")}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-gray-50 text-gray-700"
            >
              <UserCog className="w-3.5 h-3.5 text-gray-400" />
              Set Manager
            </button>
            <button
              onClick={() => openModal("permissions")}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-gray-50 text-gray-700"
            >
              <UserCheck className="w-3.5 h-3.5 text-gray-400" />
              Permissions
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Reset Password Modal */}
      {modal === "password" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Reset Password — {userName}</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {message && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {message.text}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">Enter a new password. The user must use it on their next login.</p>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Resetting…" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Manager Modal */}
      {modal === "manager" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Set Manager — {userName}</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {message && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {message.text}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">Select the direct superior for {userName}.</p>
            <div className="mb-3">
              <PeoplePicker
                people={eligibleManagers}
                value={managerId}
                onChange={setManagerId}
                placeholder="Search by name, role, department…"
                emptyLabel="— No manager —"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSetManager} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {modal === "editName" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Edit Name</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {message && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {message.text}
              </div>
            )}
            <input
              type="text"
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  const trimmed = editedName.trim()
                  if (!trimmed) { setMessage({ type: "err", text: "Name cannot be empty" }); return }
                  setSaving(true); setMessage(null)
                  try {
                    const res = await fetch(`/api/team/${userId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: trimmed }),
                    })
                    if (res.ok) {
                      setMessage({ type: "ok", text: "Name updated." })
                      router.refresh()
                    } else {
                      const data = await res.json()
                      setMessage({ type: "err", text: data.error ?? "Failed" })
                    }
                  } catch {
                    toast.error("Connection error — please check your internet and try again.")
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Locations Modal */}
      {modal === "locations" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Assign Locations — {userName}</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {message && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {message.text}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">Select the locations this employee can submit issues for.</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto mb-4">
              {orgLocations.map(loc => (
                <label key={loc.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocations.has(loc.id)}
                    onChange={e => {
                      setSelectedLocations(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(loc.id) : next.delete(loc.id)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{loc.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  setSaving(true); setMessage(null)
                  try {
                    const res = await fetch(`/api/team/${userId}/locations`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ locationIds: Array.from(selectedLocations) }),
                    })
                    if (res.ok) {
                      setMessage({ type: "ok", text: "Locations updated." })
                      router.refresh()
                    } else {
                      const data = await res.json()
                      setMessage({ type: "err", text: data.error ?? "Failed" })
                    }
                  } catch {
                    toast.error("Connection error — please check your internet and try again.")
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {modal === "permissions" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Permissions — {userName}</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {message && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {message.text}
              </div>
            )}
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg border ${canGrantInvite ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">Can Invite Users</p>
                  <p className="text-xs text-gray-500">Invite new members to their department</p>
                  {!canGrantInvite && <p className="text-xs text-amber-600 mt-0.5">Only for Managers &amp; Supervisors</p>}
                </div>
                <button
                  onClick={() => canGrantInvite && togglePermission("canInvite", !localCanInvite)}
                  disabled={saving || !canGrantInvite}
                  className="ml-3 shrink-0"
                >
                  {localCanInvite
                    ? <ToggleRight className="w-8 h-8 text-blue-600" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />
                  }
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Can Change Email</p>
                  <p className="text-xs text-gray-500">Allow user to update their email address</p>
                </div>
                <button
                  onClick={() => togglePermission("canChangeEmail", !localCanChangeEmail)}
                  disabled={saving}
                  className="ml-3 shrink-0"
                >
                  {localCanChangeEmail
                    ? <ToggleRight className="w-8 h-8 text-blue-600" />
                    : <ToggleLeft className="w-8 h-8 text-gray-300" />
                  }
                </button>
              </div>
            </div>
            <button onClick={closeModal} className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </>
  )
}
