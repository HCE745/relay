import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"

// Recurring-invoice enforcement (pre-launch). org-db is mocked so this proves
// generatePeriodInvoicesAllOrgs SKIPS a lapsed org when enforcement is on (never
// drafting new invoices for it) while staying a no-op when the switch is off.

const orgFindMany = vi.fn()
const servicePlanFindMany = vi.fn()

vi.mock("../../org-db", () => ({
  systemDb: { organization: { findMany: (...a: unknown[]) => orgFindMany(...a) } },
  orgDb: () => ({ servicePlan: { findMany: (...a: unknown[]) => servicePlanFindMany(...a) } }),
}))
vi.mock("../invoices", () => ({ generateInvoice: vi.fn() }))

import { generatePeriodInvoicesAllOrgs } from "../period-invoicing"

const lapsed = { id: "o_lapsed", isDemo: false, subscriptionStatus: "canceled", trialEndsAt: null, stripeSubscriptionId: "sub_1", currentPeriodEnd: new Date(Date.now() - 1_000_000_000) }
const paid = { id: "o_paid", isDemo: false, subscriptionStatus: "active", trialEndsAt: null, stripeSubscriptionId: "sub_1", currentPeriodEnd: new Date(Date.now() + 1_000_000_000) }

beforeEach(() => {
  orgFindMany.mockReset()
  servicePlanFindMany.mockReset().mockResolvedValue([])
})
afterEach(() => vi.unstubAllEnvs())

describe("generatePeriodInvoicesAllOrgs — subscription enforcement", () => {
  it("skips a lapsed org when enforcement is ON and drafts nothing for it", async () => {
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "on")
    orgFindMany.mockResolvedValue([lapsed])
    const res = await generatePeriodInvoicesAllOrgs()
    expect(res).toEqual([{ orgId: "o_lapsed", customers: 0, created: 0, skippedBilling: true }])
    expect(servicePlanFindMany).not.toHaveBeenCalled()
  })

  it("still invoices a paid org when enforcement is ON", async () => {
    vi.stubEnv("CLEANING_SUBSCRIPTION_ENFORCEMENT", "on")
    orgFindMany.mockResolvedValue([paid])
    const res = await generatePeriodInvoicesAllOrgs()
    expect(res[0]).toMatchObject({ orgId: "o_paid", customers: 0, created: 0 })
    expect(res[0].skippedBilling).toBeUndefined()
    expect(servicePlanFindMany).toHaveBeenCalledTimes(1)
  })

  it("is a no-op gate when enforcement is OFF (the lapsed org is still invoiced)", async () => {
    orgFindMany.mockResolvedValue([lapsed])
    const res = await generatePeriodInvoicesAllOrgs()
    expect(res[0].skippedBilling).toBeUndefined()
    expect(servicePlanFindMany).toHaveBeenCalledTimes(1)
  })
})
