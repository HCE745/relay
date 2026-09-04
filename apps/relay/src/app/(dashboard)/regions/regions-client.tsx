"use client"

import { useState } from "react"
import { Plus, MapPin, Users, Edit2, Trash2, X, ChevronDown, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface Region {
  id: string
  name: string
  description: string | null
  locationCount: number
  userCount: number
  locations: { id: string; name: string }[]
}

interface Location {
  id: string
  name: string
  regionId: string | null
}

export function RegionsClient({
  regions: initialRegions,
  allLocations,
  canEdit,
}: {
  regions: Region[]
  allLocations: Location[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [regions, setRegions] = useState(initialRegions)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const url = editingId ? `/api/regions/${editingId}` : "/api/regions"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to save")
        return
      }
      router.refresh()
      setShowForm(false); setEditingId(null); setName(""); setDescription("")
    } finally { setSaving(false) }
  }

  async function deleteRegion(id: string) {
    if (!confirm("Delete this region? Locations will be unassigned but not deleted.")) return
    await fetch(`/api/regions/${id}`, { method: "DELETE" })
    setRegions(r => r.filter(x => x.id !== id))
  }

  function startEdit(r: Region) {
    setEditingId(r.id); setName(r.name); setDescription(r.description ?? ""); setShowForm(true)
  }

  function cancel() {
    setShowForm(false); setEditingId(null); setName(""); setDescription(""); setError("")
  }

  const unassigned = allLocations.filter(l => !l.regionId)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header action */}
      {canEdit && !showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setName(""); setDescription("") }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Region
        </button>
      )}

      {/* Form */}
      {showForm && canEdit && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{editingId ? "Edit Region" : "New Region"}</h3>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Northeast Region"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={cancel} className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm rounded-lg border border-gray-300 hover:border-gray-400 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regions list */}
      {regions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No regions yet. Add your first region to start grouping locations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {regions.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {expandedId === r.id
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {r.locationCount} locations
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {r.userCount} users
                  </span>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteRegion(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {expandedId === r.id && r.locations.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-2">Locations in this region</p>
                  <div className="flex flex-wrap gap-2">
                    {r.locations.map(l => (
                      <span key={l.id} className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full text-gray-700">
                        {l.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {expandedId === r.id && r.locations.length === 0 && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  <p className="text-xs text-gray-400">No locations assigned to this region yet. Edit a location to assign it here.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unassigned locations */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            {unassigned.length} location{unassigned.length !== 1 ? "s" : ""} not assigned to any region
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(l => (
              <span key={l.id} className="text-xs px-2.5 py-1 bg-white border border-amber-200 rounded-full text-gray-700">
                {l.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-2">Go to Locations to assign these to a region.</p>
        </div>
      )}
    </div>
  )
}
