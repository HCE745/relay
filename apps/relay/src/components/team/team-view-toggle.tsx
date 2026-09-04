"use client"

import { useRouter } from "next/navigation"
import { List, GitBranch } from "lucide-react"

export function TeamViewToggle({ currentView }: { currentView: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => router.push("/team")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          currentView !== "chart" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <List className="w-3.5 h-3.5" />
        List
      </button>
      <button
        onClick={() => router.push("/team?view=chart")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          currentView === "chart" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <GitBranch className="w-3.5 h-3.5" />
        Org Chart
      </button>
    </div>
  )
}
