/**
 * Tests for white-glove onboarding test-mode capability.
 *
 * Covers:
 * - POST /onboarding: isTest=true creates org with isDemo=true
 * - POST /onboarding: isTest=true with non-test email → 400
 * - POST /onboarding: isTest=true with valid test email patterns
 * - POST /onboarding: without isTest → isDemo=false (default preserved)
 * - GET  /onboarding list: response includes organization.isDemo
 * - GET  /onboarding/[id]: response includes organization.isDemo
 * - syncRegistrationToCrm: isDemo=true org bypasses CRM sync (isolation guard)
 * - Authorization guards on POST and GETs
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/email", () => ({
  sendEmail:             vi.fn().mockResolvedValue({ ok: true }),
  whiteGloveInviteEmail: vi.fn().mockReturnValue("<html>invite</html>"),
}))

vi.mock("@/lib/billing-config", () => ({
  TRIAL_DAYS: 30,
}))

vi.mock("@/lib/sa-audit", () => ({
  logSAAction: vi.fn(),
}))

const mockFindMany              = vi.fn()
const mockFindUnique            = vi.fn()
const mockFindFirst             = vi.fn()
const mockCreate                = vi.fn()
const mockUpdate                = vi.fn()
const mockTx                    = vi.fn()
const mockOrgFindUnique         = vi.fn()
const mockUserFindUnique        = vi.fn()
const mockProspectCreate        = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: {
      findMany:   (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findFirst:  (...a: unknown[]) => mockFindFirst(...a),
      create:     (...a: unknown[]) => mockCreate(...a),
      update:     (...a: unknown[]) => mockUpdate(...a),
    },
    organization: {
      create:     vi.fn(),
      update:     vi.fn(),
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    invitation: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    prospect: {
      findMany:  vi.fn().mockResolvedValue([]),
      create:    (...a: unknown[]) => mockProspectCreate(...a),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    prospectContact: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    salesUser: {
      findMany:  vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update:    vi.fn(),
    },
    $transaction: (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email"
import { GET as LIST, POST as CREATE } from "@/app/api/super-admin/onboarding/route"
import { GET } from "@/app/api/super-admin/onboarding/[id]/route"
import { POST as LAUNCH } from "@/app/api/super-admin/onboarding/[id]/launch/route"
import { POST as RESEND } from "@/app/api/super-admin/onboarding/[id]/resend-invitation/route"
import { syncRegistrationToCrm } from "@/lib/registration-crm-sync"

const mockGetSession = vi.mocked(getSession)

const SA_SESSION = { superAdmin: true, superAdminId: "sa-1", name: "Admin User", email: "admin@relay.com" }

function jsonReq(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("https://test.example/api/", {
    method,
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  })
}

function getReq(): NextRequest {
  return new NextRequest("https://test.example/api/", { method: "GET" })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Shared setup: no duplicate user/onboarding; transaction succeeds with isDemo captured
function setupSuccessfulCreate(isDemo: boolean) {
  mockUserFindUnique.mockResolvedValue(null)
  mockFindFirst.mockResolvedValue(null)
  const capturedOrgData: Record<string, unknown> = {}
  mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const fakeOrg = { id: "org-new", name: "Acme", slug: "acme-123", subscriptionStatus: "draft", plan: "essentials", isDemo }
    const fakeOb  = { id: "ob-new", organizationId: "org-new", status: "draft", primaryContactEmail: "test@example.com" }
    const tx = {
      organization: {
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(capturedOrgData, data)
          return fakeOrg
        }),
      },
      customerOnboarding: { create: vi.fn().mockResolvedValue(fakeOb) },
    }
    return fn(tx)
  })
  return capturedOrgData
}

// ─── POST /onboarding — isTest flag ──────────────────────────────────────────

describe("POST /onboarding — test-mode flag", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates org with isDemo=true when isTest=true", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const capturedOrgData = setupSuccessfulCreate(true)

    const res = await CREATE(jsonReq({
      companyName:         "Test Co",
      primaryContactName:  "Tester",
      primaryContactEmail: "tester+test@example.com",
      plan:                "essentials",
      isTest:              true,
    }))

    expect(res.status).toBe(201)
    expect(capturedOrgData.isDemo).toBe(true)
  })

  it("creates org with isDemo=false when isTest is omitted", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const capturedOrgData = setupSuccessfulCreate(false)

    const res = await CREATE(jsonReq({
      companyName:         "Real Co",
      primaryContactName:  "Alice",
      primaryContactEmail: "alice@realco.com",
    }))

    expect(res.status).toBe(201)
    expect(capturedOrgData.isDemo).toBe(false)
  })

  it("creates org with isDemo=false when isTest=false", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const capturedOrgData = setupSuccessfulCreate(false)

    const res = await CREATE(jsonReq({
      companyName:         "Real Co",
      primaryContactName:  "Alice",
      primaryContactEmail: "alice@realco.com",
      isTest:              false,
    }))

    expect(res.status).toBe(201)
    expect(capturedOrgData.isDemo).toBe(false)
  })
})

// ─── POST /onboarding — test-email validation ─────────────────────────────────

describe("POST /onboarding — test-email validation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 400 when isTest=true and email is a real-looking address", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)

    const res = await CREATE(jsonReq({
      companyName:         "Test Co",
      primaryContactName:  "Tester",
      primaryContactEmail: "alice@acme.com",  // no +test, not @example.com, not @relay-test.internal
      isTest:              true,
    }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/test email/i)
  })

  it("accepts email containing +test when isTest=true", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    setupSuccessfulCreate(true)

    const res = await CREATE(jsonReq({
      companyName:         "Test Co",
      primaryContactName:  "Tester",
      primaryContactEmail: "qa+test@acme.com",
      isTest:              true,
    }))

    expect(res.status).toBe(201)
  })

  it("accepts @example.com address when isTest=true", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    setupSuccessfulCreate(true)

    const res = await CREATE(jsonReq({
      companyName:         "Test Co",
      primaryContactName:  "Tester",
      primaryContactEmail: "tester@example.com",
      isTest:              true,
    }))

    expect(res.status).toBe(201)
  })

  it("accepts @relay-test.internal address when isTest=true", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    setupSuccessfulCreate(true)

    const res = await CREATE(jsonReq({
      companyName:         "Test Co",
      primaryContactName:  "Tester",
      primaryContactEmail: "tester@relay-test.internal",
      isTest:              true,
    }))

    expect(res.status).toBe(201)
  })

  it("does NOT require test email pattern when isTest is omitted", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    setupSuccessfulCreate(false)

    // Real company email should be allowed when not a test org
    const res = await CREATE(jsonReq({
      companyName:         "Real Co",
      primaryContactName:  "Alice",
      primaryContactEmail: "alice@realco.com",
    }))

    expect(res.status).toBe(201)
  })
})

// ─── GET /onboarding list — includes isDemo ───────────────────────────────────

describe("GET /onboarding list — includes isDemo", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await LIST()
    expect(res.status).toBe(403)
  })

  it("includes organization.isDemo in each record", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindMany.mockResolvedValue([
      {
        id: "ob-1", status: "draft",
        organization: { id: "org-1", name: "Test Co", subscriptionStatus: "draft", plan: "essentials", isDemo: true },
      },
      {
        id: "ob-2", status: "configuring",
        organization: { id: "org-2", name: "Real Co", subscriptionStatus: "draft", plan: "essentials", isDemo: false },
      },
    ])

    const res = await LIST()
    expect(res.status).toBe(200)
    const data = await res.json() as Array<{ id: string; organization: { isDemo: boolean } }>
    expect(data[0].organization.isDemo).toBe(true)
    expect(data[1].organization.isDemo).toBe(false)
  })
})

// ─── GET /onboarding/[id] — includes isDemo ───────────────────────────────────

describe("GET /onboarding/[id] — includes isDemo", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(getReq(), params("ob-1"))
    expect(res.status).toBe(403)
  })

  it("includes organization.isDemo=true for test org", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      id: "ob-1", status: "draft",
      organization: {
        id: "org-1", name: "Test Co", slug: "test-co", plan: "essentials", isDemo: true,
        subscriptionStatus: "draft", trialStartDate: null, trialEndsAt: null, createdAt: new Date(),
      },
    })

    const res = await GET(getReq(), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { organization: { isDemo: boolean } }
    expect(data.organization.isDemo).toBe(true)
  })

  it("includes organization.isDemo=false for real org", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      id: "ob-2", status: "configuring",
      organization: {
        id: "org-2", name: "Real Co", slug: "real-co", plan: "essentials", isDemo: false,
        subscriptionStatus: "draft", trialStartDate: null, trialEndsAt: null, createdAt: new Date(),
      },
    })

    const res = await GET(getReq(), params("ob-2"))
    expect(res.status).toBe(200)
    const data = await res.json() as { organization: { isDemo: boolean } }
    expect(data.organization.isDemo).toBe(false)
  })
})

// ─── syncRegistrationToCrm — isDemo isolation guard ──────────────────────────

describe("syncRegistrationToCrm — isDemo CRM isolation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("skips CRM sync for isDemo=true org and creates no Prospect", async () => {
    // Org is a demo/test org — should be an early return
    mockOrgFindUnique.mockResolvedValue({ isDemo: true, crmProspectId: null })

    await syncRegistrationToCrm({
      orgId:      "org-demo",
      orgName:    "Test Co",
      adminEmail: "tester@example.com",
      adminName:  "Tester",
    })

    expect(mockProspectCreate).not.toHaveBeenCalled()
  })

  it("also skips when org is already linked (idempotency guard)", async () => {
    mockOrgFindUnique.mockResolvedValue({ isDemo: false, crmProspectId: "prospect-existing" })

    await syncRegistrationToCrm({
      orgId:      "org-linked",
      orgName:    "Linked Co",
      adminEmail: "alice@linkedco.com",
      adminName:  "Alice",
    })

    expect(mockProspectCreate).not.toHaveBeenCalled()
  })

  it("skips when org is not found", async () => {
    mockOrgFindUnique.mockResolvedValue(null)

    await syncRegistrationToCrm({
      orgId:      "org-missing",
      orgName:    "Ghost Co",
      adminEmail: "ghost@example.com",
      adminName:  "Ghost",
    })

    expect(mockProspectCreate).not.toHaveBeenCalled()
  })
})

// ─── Launch email suppression for test orgs ───────────────────────────────────

const LAUNCH_RECORD_BASE = {
  id:                  "ob-1",
  organizationId:      "org-1",
  status:              "ready_to_launch",
  primaryContactName:  "Tester",
  primaryContactEmail: "tester@example.com",
  plan:                "essentials",
  trialStartDate:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  invitationSentAt:    null,
  invitationToken:     null,
  checklist:           [],
}

function setupLaunchTx() {
  mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      invitation:         { create: vi.fn().mockResolvedValue({}) },
      organization:       { update: vi.fn().mockResolvedValue({}) },
      customerOnboarding: { update: vi.fn().mockResolvedValue({}) },
    }
    return fn(tx)
  })
}

describe("POST /onboarding/[id]/launch — email suppression", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("skips sendEmail for isDemo=true org and returns emailSuppressed=true", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...LAUNCH_RECORD_BASE,
      organization: { id: "org-1", name: "Test Co", isDemo: true },
    })
    mockUserFindUnique.mockResolvedValue(null)
    setupLaunchTx()

    const res = await LAUNCH(jsonReq({ force: true }), params("ob-1"))
    expect(res.status).toBe(200)

    const body = await res.json() as { emailSuppressed: boolean; inviteUrl: string }
    expect(body.emailSuppressed).toBe(true)
    expect(body.inviteUrl).toMatch(/^https?:\/\/.+\/invite\/.+/)
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })

  it("calls sendEmail for isDemo=false org and returns emailSuppressed=false", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...LAUNCH_RECORD_BASE,
      primaryContactEmail: "alice@realco.com",
      organization: { id: "org-1", name: "Real Co", isDemo: false },
    })
    mockUserFindUnique.mockResolvedValue(null)
    setupLaunchTx()
    vi.mocked(sendEmail).mockResolvedValue({ ok: true } as never)

    const res = await LAUNCH(jsonReq({ force: true }), params("ob-1"))
    expect(res.status).toBe(200)

    const body = await res.json() as { emailSuppressed: boolean; emailDelivered: boolean }
    expect(body.emailSuppressed).toBe(false)
    expect(body.emailDelivered).toBe(true)
    expect(vi.mocked(sendEmail)).toHaveBeenCalledOnce()
  })
})

// ─── Resend invitation email suppression for test orgs ────────────────────────

describe("POST /onboarding/[id]/resend-invitation — email suppression", () => {
  beforeEach(() => { vi.clearAllMocks() })

  const RESEND_RECORD = {
    id:                  "ob-1",
    organizationId:      "org-1",
    status:              "invitation_sent",
    primaryContactName:  "Tester",
    primaryContactEmail: "tester@example.com",
    invitationToken:     "existing-token",
    invitationSentAt:    new Date(),
    organization:        { id: "org-1", name: "Test Co", isDemo: true },
  }

  it("skips sendEmail for isDemo=true org", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(RESEND_RECORD)
    mockUserFindUnique.mockResolvedValue(null)
    // existing invitation is still valid
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usedAt:    null,
    } as never)

    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(200)

    const body = await res.json() as { emailSuppressed: boolean; inviteUrl: string }
    expect(body.emailSuppressed).toBe(true)
    expect(body.inviteUrl).toMatch(/\/invite\//)
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })
})

// ─── GET /onboarding/[id] — returns inviteUrl when token is set ───────────────

describe("GET /onboarding/[id] — inviteUrl computed from token", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("includes inviteUrl when invitationToken is present", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      id: "ob-1", status: "invitation_sent",
      invitationToken: "abc-token-123",
      organization: {
        id: "org-1", name: "Test Co", slug: "test-co", plan: "essentials", isDemo: true,
        subscriptionStatus: "trialing", trialStartDate: null, trialEndsAt: null, createdAt: new Date(),
      },
    })

    const res = await GET(getReq(), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { inviteUrl: string }
    expect(data.inviteUrl).toMatch(/\/invite\/abc-token-123$/)
  })

  it("returns inviteUrl=null when no invitationToken", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      id: "ob-2", status: "draft",
      invitationToken: null,
      organization: {
        id: "org-2", name: "Test Co 2", slug: "test-co-2", plan: "essentials", isDemo: true,
        subscriptionStatus: "draft", trialStartDate: null, trialEndsAt: null, createdAt: new Date(),
      },
    })

    const res = await GET(getReq(), params("ob-2"))
    expect(res.status).toBe(200)
    const data = await res.json() as { inviteUrl: string | null }
    expect(data.inviteUrl).toBeNull()
  })
})
