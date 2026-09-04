"use client"

export function ExternalBadge({ userType }: { userType: string }) {
  if (userType !== "EXTERNAL") return null
  return (
    <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
      External
    </span>
  )
}
