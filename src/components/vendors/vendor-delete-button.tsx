"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"

interface Props {
  vendorId: string
  vendorName: string
}

export function VendorDeleteButton({ vendorId, vendorName }: Props) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  async function handleDelete() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? "Delete failed")
        setLoading(false)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(""); setOpen(true) }}
        className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded border border-gray-200 hover:border-red-300 transition-colors"
        title="Delete vendor"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Delete vendor?</h2>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              You are about to permanently delete{" "}
              <span className="font-semibold text-gray-900">{vendorName}</span>.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              All vendor data will be removed. Issues and assets linked to this vendor will remain but lose the vendor association.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                  : <><Trash2 className="w-3.5 h-3.5" /> Delete Vendor</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
