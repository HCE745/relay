export const LIFECYCLE_STAGES = [
  "Lead",
  "Demo Scheduled",
  "Demo Completed",
  "Trial Started",
  "Trial Active",
  "Trial Expired",
  "Converted",
  "Cancelled",
  "Lost",
] as const

export type LifecycleStatus = typeof LIFECYCLE_STAGES[number]

// Badge classes — dark-theme-safe (for super admin panel dark background)
export const LIFECYCLE_COLORS: Record<string, string> = {
  "Lead":           "bg-slate-600 text-slate-100",
  "Demo Scheduled": "bg-blue-700 text-blue-100",
  "Demo Completed": "bg-violet-700 text-violet-100",
  "Trial Started":  "bg-amber-700 text-amber-100",
  "Trial Active":   "bg-teal-600 text-teal-100",
  "Trial Expired":  "bg-orange-700 text-orange-100",
  "Converted":      "bg-green-600 text-white",
  "Cancelled":      "bg-red-700 text-red-100",
  "Lost":           "bg-gray-700 text-gray-300",
}

// Accent colors for pipeline stage cards (bg, border, text)
export const LIFECYCLE_CARD_COLORS: Record<string, { card: string; count: string; label: string }> = {
  "Lead":           { card: "bg-slate-800 border-slate-600",   count: "text-slate-100",  label: "text-slate-400"  },
  "Demo Scheduled": { card: "bg-blue-900/50 border-blue-700",  count: "text-blue-100",   label: "text-blue-400"   },
  "Demo Completed": { card: "bg-violet-900/50 border-violet-700", count: "text-violet-100", label: "text-violet-400" },
  "Trial Started":  { card: "bg-amber-900/50 border-amber-700", count: "text-amber-100", label: "text-amber-400"  },
  "Trial Active":   { card: "bg-teal-900/50 border-teal-600",  count: "text-teal-100",   label: "text-teal-400"   },
  "Trial Expired":  { card: "bg-orange-900/50 border-orange-700", count: "text-orange-100", label: "text-orange-400" },
  "Converted":      { card: "bg-green-900/60 border-green-600", count: "text-green-100", label: "text-green-400"  },
  "Cancelled":      { card: "bg-red-900/50 border-red-700",    count: "text-red-100",    label: "text-red-400"    },
  "Lost":           { card: "bg-gray-800 border-gray-700",      count: "text-gray-300",   label: "text-gray-500"   },
}
