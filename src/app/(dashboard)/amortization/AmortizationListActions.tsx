"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play } from "lucide-react"

type DueEntry = { id: string; scheduleId: string; periodDate: Date; posted: boolean }

export function AmortizationListActions({ dueEntries }: { dueEntries: DueEntry[] }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function postAllDue() {
    if (dueEntries.length === 0) {
      toast.info("No entries due today")
      return
    }

    setRunning(true)
    // Group by scheduleId
    const bySchedule = dueEntries.reduce<Record<string, number[]>>((acc, e) => {
      if (!acc[e.scheduleId]) acc[e.scheduleId] = []
      return acc
    }, {})

    // We'll just call post on each schedule without periodNumbers — it posts all due
    const scheduleIds = [...new Set(dueEntries.map((e) => e.scheduleId))]
    let totalPosted = 0
    let errors = 0

    for (const scheduleId of scheduleIds) {
      try {
        const res = await fetch(`/api/amortization/${scheduleId}/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (!res.ok) {
          errors++
          toast.error(data.error ?? `Error posting schedule ${scheduleId}`)
        } else {
          totalPosted += data.posted?.length ?? 0
          if (data.errors?.length) {
            data.errors.forEach((e: { error: string }) => toast.error(e.error))
          }
        }
      } catch {
        errors++
      }
    }

    setRunning(false)
    if (totalPosted > 0) toast.success(`Posted ${totalPosted} amortization entries`)
    if (errors === 0 && totalPosted === 0) toast.info("Nothing new to post")
    router.refresh()
  }

  return (
    <button
      onClick={postAllDue}
      disabled={running}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
    >
      <Play className="w-4 h-4" />
      {running ? "Posting…" : `Post Due (${dueEntries.length})`}
    </button>
  )
}
