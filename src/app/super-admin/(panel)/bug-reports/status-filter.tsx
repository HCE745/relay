"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const STATUSES = [
  { value: "all",           label: "All" },
  { value: "new",           label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "fixed",         label: "Fixed" },
  { value: "closed",        label: "Closed" },
]

export function BugReportStatusFilter({
  activeStatus,
  countMap,
  total,
}: {
  activeStatus: string
  countMap: Record<string, number>
  total: number
}) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const setStatus = useCallback((status: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === "all") params.delete("status")
    else params.set("status", status)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex gap-1 mb-4 flex-wrap">
      {STATUSES.map(s => {
        const count = s.value === "all" ? total : (countMap[s.value] ?? 0)
        const active = activeStatus === s.value
        return (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              active
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700"
            }`}
          >
            {s.label}
            <span className={`${active ? "bg-indigo-500" : "bg-gray-700"} px-1.5 py-0.5 rounded-full text-[10px]`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
