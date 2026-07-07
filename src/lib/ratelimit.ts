import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

// ─── Redis client ─────────────────────────────────────────────────────────────
// Only instantiated when credentials are present. All limiters are null otherwise,
// and every check() call fails open (allows the request through).

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

function make(tokens: number, window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix:  "rl",
    analytics: false,
  })
}

// ─── Per-endpoint limiters ────────────────────────────────────────────────────

export const limiters = {
  // Auth — IP-based
  login:       make(5,   "10 m"),  // 5 attempts / 10 min
  register:    make(3,   "1 h"),   // 3 new accounts / hour
  forgotPw:    make(3,   "1 h"),   // 3 reset requests / hour

  // Submission — user-based
  issues:      make(50,  "1 h"),   // 50 issues / hour / user
  suggestions: make(50,  "1 h"),   // 50 suggestions / hour / user
  invitations: make(20,  "1 h"),   // 20 invites / hour / user

  // AI cost guard — org-based
  aiOrg:       make(100, "1 h"),   // 100 AI calls / hour / org

  // Global backstop — IP-based
  global:      make(500, "1 m"),   // 500 requests / min / IP
} as const

// ─── IP extraction ────────────────────────────────────────────────────────────

export function getIP(req: { headers: { get(k: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  )
}

// ─── API-route helper (returns NextResponse | null) ───────────────────────────

export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
  message = "Too many requests. Please try again later.",
): Promise<NextResponse | null> {
  if (!limiter) return null  // Redis not configured — fail open

  try {
    const { success, reset } = await limiter.limit(identifier)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            "Retry-After":      String(retryAfter),
            "X-RateLimit-Reset": String(reset),
          },
        },
      )
    }
    return null
  } catch {
    return null  // Redis unavailable — fail open, don't block traffic
  }
}

// ─── Server-Action helper (returns error string | null) ───────────────────────
// Server Actions can't return NextResponse, so we return a plain error string.

export async function checkLimitAction(
  limiter: Ratelimit | null,
  identifier: string,
  message = "Too many requests. Please try again later.",
): Promise<string | null> {
  if (!limiter) return null

  try {
    const { success } = await limiter.limit(identifier)
    return success ? null : message
  } catch {
    return null  // Fail open
  }
}
