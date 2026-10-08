import { createHash } from "node:crypto"

// Shared abuse controls for PUBLIC, unauthenticated write endpoints (online
// quote booking, job applications). Treat every caller as hostile: hash the IP,
// rate-limit per IP and per org, and drop bot submissions via a honeypot field.
// Each caller supplies the recent counts (from its own model); this module
// holds the thresholds + pure checks so they stay consistent.

export const INTAKE_LIMITS = {
  ipWindowMs: 60 * 60 * 1000, // 1 hour
  ipMax: 5, // submissions per IP per hour
  orgWindowMs: 60 * 60 * 1000,
  orgMax: 60, // submissions per org per hour (hard cap)
}

export class IntakeRejected extends Error {
  constructor(public code: "rate_limit" | "capacity" | "bot", message: string) {
    super(message)
    this.name = "IntakeRejected"
  }
}

export function hashIp(ip: string): string {
  const salt = process.env.CLEANING_SESSION_SECRET ?? "intake-salt"
  return createHash("sha256").update(`intake:${salt}:${ip}`).digest("hex")
}

/** Honeypot: a hidden field real users never fill. Any value ⇒ bot. */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

/** Throw IntakeRejected when counts exceed the per-IP or per-org limits. */
export function enforceIntakeLimits(recentForIp: number, recentForOrg: number): void {
  if (recentForOrg >= INTAKE_LIMITS.orgMax) throw new IntakeRejected("capacity", "We're receiving a high volume of requests right now. Please try again shortly.")
  if (recentForIp >= INTAKE_LIMITS.ipMax) throw new IntakeRejected("rate_limit", "You've submitted several requests recently. Please wait a little while before submitting again.")
}
