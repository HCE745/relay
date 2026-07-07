"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  org: { id: string; name: string; slug: string; industry: string | null }
}

export function OrgSettingsForm({ org }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const formData = new FormData(e.currentTarget)
    await fetch(`/api/org`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    })
    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {saved && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          Settings saved successfully.
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
        <input name="name" defaultValue={org.name} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
        <select name="industry" defaultValue={org.industry ?? ""} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Select industry</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Warehousing">Warehousing</option>
          <option value="Logistics">Logistics</option>
          <option value="Facilities">Facilities Management</option>
          <option value="Car Wash">Car Wash</option>
          <option value="Self Storage">Self Storage</option>
          <option value="Service">Service Company</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
        <input value={org.slug} disabled className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
        <p className="text-xs text-gray-400 mt-1">URL-safe identifier, cannot be changed</p>
      </div>
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  )
}
