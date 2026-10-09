"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, AlertTriangle, Building2, Globe, Loader2 } from "lucide-react"

type DuplicateInfo = {
  id: string
  companyName: string
  assignedToName: string | null
  currentCrmStatus: string
}

export function AddProspectModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [companyName, setCompanyName] = useState("")
  const [website, setWebsite] = useState("")
  const [industry, setIndustry] = useState("")

  // Duplicate confirmation state
  const [dupWarning, setDupWarning] = useState<{ message: string; existing: DuplicateInfo } | null>(null)

  function resetForm() {
    setCompanyName("")
    setWebsite("")
    setIndustry("")
    setDupWarning(null)
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  async function submit(confirmDuplicate: boolean) {
    if (!companyName.trim()) {
      setError("Company name is required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/sales/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
          confirmDuplicate,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDupWarning({ message: data.message, existing: data.existing })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to create prospect")
        return
      }

      handleClose()
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Prospect
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">

            {/* Duplicate confirmation dialog */}
            {dupWarning ? (
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Similar company already exists</h2>
                    <p className="text-sm text-gray-400 mt-1">{dupWarning.message}</p>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-5 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="font-medium text-gray-200">{dupWarning.existing.companyName}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5">
                    Owned by {dupWarning.existing.assignedToName ?? "unassigned"} ·{" "}
                    <span className="capitalize">{dupWarning.existing.currentCrmStatus.replace(/_/g, " ")}</span>
                  </p>
                </div>

                <p className="text-xs text-amber-400/80 mb-5">
                  Creating this prospect will flag it for admin review.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDupWarning(null)}
                    className="flex-1 px-3 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                    disabled={saving}
                  >
                    Cancel — search for existing
                  </button>
                  <button
                    onClick={() => submit(true)}
                    disabled={saving}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-600 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Yes, different company
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Normal create form */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
                  <h2 className="text-base font-semibold text-white">Add Prospect</h2>
                  <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme Manufacturing"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      onKeyDown={e => e.key === "Enter" && submit(false)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-600" />
                      <input
                        type="text"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        placeholder="acme.com"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      placeholder="Manufacturing"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 px-6 pb-5">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submit(false)}
                    disabled={saving || !companyName.trim()}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Create Prospect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
