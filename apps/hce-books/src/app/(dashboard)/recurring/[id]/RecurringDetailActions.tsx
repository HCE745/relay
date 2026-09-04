"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play, Pause, Trash2 } from "lucide-react"

export function RecurringDetailActions({ templateId, active }: { templateId: string; active: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/recurring/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(active ? "Template paused" : "Template activated")
      router.refresh()
    } else {
      toast.error("Failed to update template")
    }
  }

  async function generate() {
    setLoading(true)
    const res = await fetch(`/api/recurring/${templateId}/generate`, { method: "POST" })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? "Failed to generate")
    } else if (data.generated?.length > 0) {
      toast.success("Entry generated successfully")
      router.refresh()
    } else {
      toast.info(data.message ?? "Nothing to generate")
    }
  }

  async function deleteTemplate() {
    if (!confirm("Delete this recurring template and all its run history?")) return
    setLoading(true)
    const res = await fetch(`/api/recurring/${templateId}`, { method: "DELETE" })
    setLoading(false)
    if (res.ok) {
      toast.success("Template deleted")
      router.push("/recurring")
    } else {
      toast.error("Failed to delete")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generate}
        disabled={loading || !active}
        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
      >
        <Play className="w-4 h-4" /> Generate Now
      </button>
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
      >
        {active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {active ? "Pause" : "Activate"}
      </button>
      <button
        onClick={deleteTemplate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
