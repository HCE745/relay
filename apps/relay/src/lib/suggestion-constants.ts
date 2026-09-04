// Shared constants — safe to import from both client and server components

export type SuggestionType = "SUGGESTION" | "FEEDBACK" | "CONCERN"

export const SUGGESTION_TYPE_LABEL: Record<string, string> = {
  SUGGESTION: "Suggestion",
  FEEDBACK:   "Feedback",
  CONCERN:    "Concern",
}

export const SUGGESTION_TYPE_DESCRIPTION: Record<string, string> = {
  SUGGESTION: "An idea or improvement you'd like to propose",
  FEEDBACK:   "General feedback about a process, experience, or decision",
  CONCERN:    "Something that needs attention or has been bothering you",
}

export const SUGGESTION_TYPE_PLACEHOLDER: Record<string, string> = {
  SUGGESTION: "Share an idea or process improvement…",
  FEEDBACK:   "Share your feedback on anything — a process, a decision, or an experience…",
  CONCERN:    "Describe something that needs attention or that you're concerned about…",
}

export type SuggestionCategory =
  | "SAFETY"
  | "MAINTENANCE"
  | "HR"
  | "PROCESS"
  | "FACILITY"
  | "SUPPLY"
  | "CUSTOMER"
  | "GENERAL"

export const SUGGESTION_CATEGORY_LABEL: Record<string, string> = {
  SAFETY: "Safety & Compliance",
  MAINTENANCE: "Maintenance & Equipment",
  HR: "HR & People",
  PROCESS: "Process & Efficiency",
  FACILITY: "Facility & Space",
  SUPPLY: "Supply & Inventory",
  CUSTOMER: "Customer Service",
  GENERAL: "General",
}
