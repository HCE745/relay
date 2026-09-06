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
