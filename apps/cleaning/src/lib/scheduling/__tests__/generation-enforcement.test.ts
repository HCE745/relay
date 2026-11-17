import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"

// Background job-generation enforcement (Phase F). org-db is mocked so this
// proves the cron entry point (generateUpcomingAllOrgs) SKIPS a lapsed org when
// enforcement is on — never reaching into that org's service plans — while
// staying a complete no-op when the master switch is off.

const orgFindMany = vi.fn()
const servicePlanFindMany = vi.fn()

vi.mock("../../org-db", () => ({
  systemDb: { organization: { findMany: (...a: unknown[]) => orgFindMany(...a) } },
  orgDb: () => ({ servicePlan: { findMany: (...a: unknown[]) => servicePlanFindMany(...a) } }),
  isUniqueViolation: () => false,
}))

import { generateUpcomingAllOrgs } from "../generation"

const lapsed = { id: "o_lapsed", isDemo: false, subscriptionStatus: "past_due", trialEndsAt: null, stripeSubscriptionId: "sub_1", currentPeriodEnd: new Date(Date.now() - 1_000_000_000) }
const paid = { id: "o_paid", isDemo: false, subscriptionStatus: "active", trialEndsAt: null, stripeSubscriptionId: "sub_1", currentPeriodEnd: new Date(Date.now() + 1_000_000_000) }

beforeEach(() => {
  orgFindMany.mockReset()
  servicePlanFindMany.mockReset().mockResolvedValue([])
})
afterEach(() => vi.unstubAllEnvs())

describe("generateUpcomingAllOrgs — subscription enforcement", () => {
  it("skips a lapsed org when enforcement is ON and never touches its plans", async () => {
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "on")
    orgFindMany.mockResolvedValue([lapsed])
    const res = await generateUpcomingAllOrgs(30)
    expect(res).toEqual([{ orgId: "o_lapsed", skippedBilling: true }])
    expect(servicePlanFindMany).not.toHaveBeenCalled() // no work generated, existing jobs untouched
  })

  it("still processes a paid org when enforcement is ON", async () => {
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "on")
    orgFindMany.mockResolvedValue([paid])
    const res = await generateUpcomingAllOrgs(30)
    expect(res[0]).toMatchObject({ orgId: "o_paid", plans: 0, created: 0 })
    expect(servicePlanFindMany).toHaveBeenCalledTimes(1)
  })

  it("is a no-op gate when enforcement is OFF (the lapsed org is still processed)", async () => {
    orgFindMany.mockResolvedValue([lapsed])
    const res = await generateUpcomingAllOrgs(30)
    expect(res[0]).toMatchObject({ orgId: "o_lapsed", plans: 0 })
    expect(res[0].skippedBilling).toBeUndefined()
    expect(servicePlanFindMany).toHaveBeenCalledTimes(1)
  })
})
