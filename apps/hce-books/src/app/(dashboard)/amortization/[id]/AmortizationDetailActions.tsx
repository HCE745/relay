"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play } from "lucide-react"

type Props = {
  scheduleId: string
  dueCount: number
  unpostedPeriods: number[]
  disabled: boolean
}

export function AmortizationDetailActions({ scheduleId, dueCount, unpostedPeriods, disabled }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function postDue() {
    setLoading(true)
    const res = await fetch(`/api/amortization/${scheduleId}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? "Failed to post entries")
    } else {
      const posted = data.posted?.length ?? 0
      if (posted > 0) {
        toast.success(`Posted ${posted} ${posted === 1 ? "entry" : "entries"}`)
        if (data.completed) toast.success("Schedule completed!")
      } else {
        toast.info("No entries posted")
      }
      if (data.errors?.length) {
        data.errors.forEach((e: { error: string }) => toast.error(e.error))
      }
    }
    router.refresh()
  }

  async function postAll() {
    if (unpostedPeriods.length === 0) {
      toast.info("No unposted entries")
      return
    }
    setLoading(true)
    const res = await fetch(`/api/amortization/${scheduleId}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodNumbers: unpostedPeriods }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? "Failed to post entries")
    } else {
      const posted = data.posted?.length ?? 0
      if (posted > 0) {
        toast.success(`Posted ${posted} ${posted === 1 ? "entry" : "entries"}`)
        if (data.completed) toast.success("Schedule completed!")
      }
      if (data.errors?.length) {
        data.errors.forEach((e: { error: string }) => toast.error(e.error))
      }
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={postDue}
        disabled={loading || disabled || dueCount === 0}
        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
      >
        <Play className="w-4 h-4" /> Post Due ({dueCount})
      </button>
      <button
        onClick={postAll}
        disabled={loading || disabled || unpostedPeriods.length === 0}
        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        Post All Unposted ({unpostedPeriods.length})
      </button>
    </div>
  )
}
