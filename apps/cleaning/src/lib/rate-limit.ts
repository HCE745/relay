import { IntakeRejected } from "./public-intake"

// In-memory token-bucket rate limiter for PUBLIC unauthenticated endpoints.
// Runs BEFORE any DB work so a hot client is rejected without touching Postgres.
//
// Honest scope: state is per-process. On Vercel each warm function instance has
// its own buckets, and a cold start resets them — so this is a cheap pre-DB
// shield against a single hot source and burst spikes, NOT a globally exact
// quota. The durable, cross-instance ceiling stays in the DB per-org row cap
// (see createPublicQuote / createPublicApplication + INTAKE_LIMITS). The two
// layers are complementary.

type Bucket = { tokens: number; last: number }

export type TokenBucketConfig = { capacity: number; refillPerMs: number }

// capacity = burst allowance (spend immediately); refill = sustained rate.
export const BURST_LIMITS = {
  ip: { capacity: 5, refillPerMs: 1 / 180_000 }, // 5 burst, then ~1 / 3 min (≈20/hr) per client IP
  org: { capacity: 15, refillPerMs: 1 / 90_000 }, // 15 burst, then ~1 / 90 s (≈40/hr) per org
} satisfies Record<string, TokenBucketConfig>

const buckets = new Map<string, Bucket>()
const MAX_KEYS = 20_000
const STALE_MS = 60 * 60 * 1000

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [k, b] of buckets) if (now - b.last > STALE_MS) buckets.delete(k)
}

/** Spend one token for `key`. Returns false when the bucket is empty (limited). */
export function takeToken(key: string, cfg: TokenBucketConfig, now: number = Date.now()): boolean {
  prune(now)
  let b = buckets.get(key)
  if (!b) {
    b = { tokens: cfg.capacity, last: now }
    buckets.set(key, b)
  } else {
    b.tokens = Math.min(cfg.capacity, b.tokens + (now - b.last) * cfg.refillPerMs)
    b.last = now
  }
  if (b.tokens >= 1) {
    b.tokens -= 1
    return true
  }
  return false
}

/** Pre-DB per-IP burst guard. Throws IntakeRejected("rate_limit") when exceeded. */
export function enforceIpBurst(ipKey: string, now?: number): void {
  if (!takeToken(`ip:${ipKey}`, BURST_LIMITS.ip, now)) {
    throw new IntakeRejected("rate_limit", "You've submitted several requests very quickly. Please wait a moment and try again.")
  }
}

/** Per-org burst guard (applied after the org is resolved, before writes). */
export function enforceOrgBurst(orgId: string, now?: number): void {
  if (!takeToken(`org:${orgId}`, BURST_LIMITS.org, now)) {
    throw new IntakeRejected("capacity", "We're receiving a high volume of requests right now. Please try again shortly.")
  }
}

/** Test-only: clear all buckets so each test starts from a known state. */
export function resetRateLimiter(): void {
  buckets.clear()
}
