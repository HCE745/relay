"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

interface Props {
  locations: Array<{ id: string; name: string }>
  users?: Array<{ id: string; name: string; role: string }>
  children: React.ReactNode
  initialData?: {
    id: string
    name: string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    parentId?: string | null
    safetyContactId?: string | null
  }
}

export function LocationDialog({ locations, users = [], children, initialData }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const body = Object.fromEntries(formData.entries())
    const url = initialData ? `/api/locations/${initialData.id}` : "/api/locations"
    const method = initialData ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      setError((await res.json()).error ?? "Failed to save")
      setLoading(false)
    }
  }

  const otherLocations = locations.filter((l) => l.id !== initialData?.id)

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{initialData ? "Edit Location" : "Add Location"}</h3>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Name *</label>
                <input name="name" required defaultValue={initialData?.name} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Main Warehouse" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <input name="address" defaultValue={initialData?.address ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <input name="city" defaultValue={initialData?.city ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                  <input name="state" defaultValue={initialData?.state ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                  <input name="country" defaultValue={initialData?.country ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {otherLocations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Location</label>
                  <select name="parentId" defaultValue={initialData?.parentId ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">No parent</option>
                    {otherLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              {users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Safety / First Aid Contact</label>
                  <select name="safetyContactId" defaultValue={initialData?.safetyContactId ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">No designated contact</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">This person is notified on injury reports at this location</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {loading ? "Saving…" : initialData ? "Save Changes" : "Add Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
