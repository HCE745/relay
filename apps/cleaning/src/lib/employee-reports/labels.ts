// Shared presentation labels for employee reports (server + client). Pure.

export const CATEGORY_LABELS: Record<string, string> = {
  INCOMPLETE_WORK: "Incomplete cleaning",
  MISSED_TASK: "Missed task",
  POOR_WORKMANSHIP: "Poor workmanship",
  QUALITY_OTHER: "Other quality concern",
  ASSIGNMENT_REFUSAL: "Refused assignment",
  LEFT_EARLY: "Left early",
  PROCEDURE_VIOLATION: "Didn't follow procedure",
  OPERATIONAL_OTHER: "Other operational concern",
  HARASSMENT: "Harassment",
  THEFT: "Theft",
  THREAT: "Threat",
  SAFETY_CONCERN: "Safety concern",
  MISCONDUCT_OTHER: "Other serious concern",
}

// Category → default confidentiality tier, used to pre-select the right tier.
export const CATEGORY_DEFAULT_TIER: Record<string, "NORMAL" | "PRIVATE" | "CONFIDENTIAL"> = {
  INCOMPLETE_WORK: "NORMAL",
  MISSED_TASK: "NORMAL",
  POOR_WORKMANSHIP: "NORMAL",
  QUALITY_OTHER: "NORMAL",
  ASSIGNMENT_REFUSAL: "PRIVATE",
  LEFT_EARLY: "PRIVATE",
  PROCEDURE_VIOLATION: "PRIVATE",
  OPERATIONAL_OTHER: "PRIVATE",
  HARASSMENT: "CONFIDENTIAL",
  THEFT: "CONFIDENTIAL",
  THREAT: "CONFIDENTIAL",
  SAFETY_CONCERN: "CONFIDENTIAL",
  MISCONDUCT_OTHER: "CONFIDENTIAL",
}

export const CONFIDENTIALITY_META: Record<string, { label: string; cls: string }> = {
  NORMAL: { label: "Work quality", cls: "bg-slate-100 text-slate-600" },
  PRIVATE: { label: "Private", cls: "bg-indigo-100 text-indigo-700" },
  CONFIDENTIAL: { label: "Confidential", cls: "bg-rose-100 text-rose-700" },
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "Submitted", cls: "bg-slate-100 text-slate-600" },
  PENDING_REVIEW: { label: "Pending review", cls: "bg-amber-100 text-amber-800" },
  UNDER_REVIEW: { label: "Under review", cls: "bg-sky-100 text-sky-700" },
  SUBSTANTIATED: { label: "Substantiated", cls: "bg-red-100 text-red-700" },
  UNSUBSTANTIATED: { label: "Unsubstantiated", cls: "bg-emerald-100 text-emerald-700" },
  INCONCLUSIVE: { label: "Inconclusive", cls: "bg-slate-200 text-slate-700" },
  RESOLVED: { label: "Resolved", cls: "bg-emerald-100 text-emerald-700" },
}

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c
}
