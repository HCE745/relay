import { createHash, randomBytes } from "node:crypto"
import { systemDb } from "../org-db"
import { seedDemoOrg, type DemoMix } from "./seed"

// Demo org lifecycle + abuse controls. A demo org is a normal org with isDemo
// set; isolation still runs through orgDb. This module is the ONLY place demo
// orgs are created, and it enforces the resource-exhaustion guards.

export const DEMO_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CONCURRENT_DEMOS = 250 // hard global cap
const PER_IP_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const PER_IP_MAX = 3 // new demo orgs per IP per hour

export class DemoLimitError extends Error {
  constructor(public code: "capacity" | "rate_limit", message: string) {
    super(message)
    this.name = "DemoLimitError"
  }
}

function hashIp(ip: string): string {
  const salt = process.env.CLEANING_SESSION_SECRET ?? "demo-salt"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex")
}

export async function countActiveDemos(now = new Date()): Promise<number> {
  return systemDb.organization.count({ where: { isDemo: true, demoExpiresAt: { gt: now } } })
}

export type DemoOwner = { orgId: string; owner: { id: string; email: string; name: string } }

/**
 * Create a seeded demo org for a visitor. Enforces a global concurrency cap and
 * a per-IP hourly rate limit. `replaceOrgId` (reseed) deletes the visitor's
 * existing demo org first and skips the limits (net-zero, same visitor).
 */
export async function createDemoOrg(ip: string, mix: DemoMix, opts: { replaceOrgId?: string } = {}): Promise<DemoOwner> {
  const now = new Date()
  const ipHash = hashIp(ip)

  if (opts.replaceOrgId) {
    // Reseed: remove the old demo org (only if it really is a demo org).
    await systemDb.organization.deleteMany({ where: { id: opts.replaceOrgId, isDemo: true } })
  } else {
    if ((await countActiveDemos(now)) >= MAX_CONCURRENT_DEMOS) {
      throw new DemoLimitError("capacity", "The demo is at capacity right now. Please try again shortly.")
    }
    const recent = await systemDb.organization.count({
      where: { demoIpHash: ipHash, createdAt: { gt: new Date(now.getTime() - PER_IP_WINDOW_MS) } },
    })
    if (recent >= PER_IP_MAX) {
      throw new DemoLimitError("rate_limit", "You've started several demos recently. Please wait a little while before starting another.")
    }
  }

  const org = await systemDb.organization.create({
    data: {
      name: "Demo Workspace", slug: `demo-${randomBytes(6).toString("hex")}`, packageTier: "ENTERPRISE",
      isDemo: true, demoExpiresAt: new Date(now.getTime() + DEMO_TTL_MS), demoIpHash: ipHash,
      onboardingCompletedAt: now, subscriptionStatus: "active", timezone: "America/Chicago",
    },
    select: { id: true },
  })
  const { owner } = await seedDemoOrg(org.id, mix)
  return { orgId: org.id, owner }
}

/**
 * Purge expired demo orgs. Each org is deleted independently in its own
 * statement (DB cascade removes all children atomically for that org). A
 * failure on one org is caught and logged so it never blocks the others — the
 * org stays marked expired and is retried on the next run.
 */
export async function purgeExpiredDemoOrgs(now = new Date()): Promise<{ purged: number; failed: number; failures: string[] }> {
  const expired = await systemDb.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: now } },
    select: { id: true },
  })
  let purged = 0
  let failed = 0
  const failures: string[] = []
  for (const o of expired) {
    try {
      await systemDb.organization.delete({ where: { id: o.id } }) // cascades to all children in one tx
      purged++
    } catch (e) {
      failed++
      failures.push(`${o.id}: ${(e as Error).message}`)
    }
  }
  return { purged, failed, failures }
}

/** True if the org is a demo org (used to block email/Blob side-effects). */
export async function isDemoOrg(orgId: string): Promise<boolean> {
  const o = await systemDb.organization.findUnique({ where: { id: orgId }, select: { isDemo: true } })
  return !!o?.isDemo
}
