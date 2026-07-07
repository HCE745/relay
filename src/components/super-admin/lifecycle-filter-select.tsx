"use client"

import { LIFECYCLE_STAGES } from "@/lib/crm-lifecycle-constants"

export function LifecycleFilterSelect({ current }: { current?: string }) {
  return (
    <select
      value={current ?? ""}
      onChange={e => {
        const url = new URL(window.location.href)
        e.target.value
          ? url.searchParams.set("lifecycle", e.target.value)
          : url.searchParams.delete("lifecycle")
        window.location.href = url.toString()
      }}
      className="px-2 py-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">All</option>
      {LIFECYCLE_STAGES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
