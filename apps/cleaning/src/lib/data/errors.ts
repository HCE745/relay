// Thrown when a referenced record (Customer, ServiceLocation, ChecklistTemplate,
// …) does not exist within the authenticated organization. Routes map this to a
// 404/400 — it deliberately does NOT distinguish "not found" from "belongs to
// another org", so cross-org ids are indistinguishable from missing ones.
export class ReferenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReferenceError"
  }
}

/** Throw if a record fetched by an org-scoped query came back null. */
export function assertFound<T>(record: T | null, label: string): T {
  if (record === null || record === undefined) {
    throw new ReferenceError(`${label} not found in this organization`)
  }
  return record
}

/** Actor is authenticated but not permitted to act on this record (→ 403). */
export class ForbiddenActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForbiddenActionError"
  }
}

/** The action conflicts with current state, e.g. an already-open entry (→ 409). */
export class ConflictError extends Error {
  details?: unknown
  constructor(message: string, details?: unknown) {
    super(message)
    this.name = "ConflictError"
    this.details = details
  }
}

/** Preconditions unmet, e.g. required checklist/photos incomplete (→ 422). */
export class RequirementsError extends Error {
  unmet: string[]
  constructor(message: string, unmet: string[]) {
    super(message)
    this.name = "RequirementsError"
    this.unmet = unmet
  }
}
