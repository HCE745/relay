/**
 * Tests for Phase C: configure/users GET + GET /wizard dataReadiness.
 *
 * Covers:
 * - GET /configure/users: SA required, record not found, returns users + invitations + primaryContactEmail
 * - GET /configure/users: excludes inactive users and used/expired invitations
 * - GET /configure/users: org isolation (users from onboarding's orgId only)
 * - GET /wizard: dataReadiness overview=true when email+trialStartDate present
 * - GET /wizard: dataReadiness overview=false when trialStartDate missing
 * - GET /wizard: dataReadiness locations=true when locationCount >= 1
 * - GET /wizard: dataReadiness data-driven steps override completedSteps from wizardProgress
 * - GET /wizard: response includes counts object
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockOnboardingFindUnique = vi.fn()
const mockUserFindMany         = vi.fn()
const mockInvitationFindMany   = vi.fn()
const mockCountFn              = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: { findUnique: (...a: unknown[]) => mockOnboardingFindUnique(...a) },
    user:               { findMany: (...a: unknown[]) => mockUserFindMany(...a), count: (...a: unknown[]) => mockCountFn(...a) },
    invitation:         { findMany: (...a: unknown[]) => mockInvitationFindMany(...a), count: (...a: unknown[]) => mockCountFn(...a) },
    location:           { count: (...a: unknown[]) => mockCountFn(...a) },
    department:         { count: (...a: unknown[]) => mockCountFn(...a) },
    employeeType:       { count: (...a: unknown[]) => mockCountFn(...a) },
  },
}))

import { getSession } from "@/lib/session"
const mockGetSession = getSession as ReturnType<typeof vi.fn>

const SA_SESSION = {
  superAdmin: true, superAdminId: "sa-1", name: "Will Hunt",
  userId: null, organizationId: null, salesUserId: null, role: null,
}

const BASE_ONBOARDING = {
  id:                  "ob-1",
  organizationId:      "org-1",
  primaryContactEmail: "alice@acme.com",
  primaryContactName:  "Alice Smith",
  status:              "configuring",
  plan:                "professional",
  trialStartDate:      null,
  wizardProgress:      null,
  internalNotes:       null,
  organization: {
    id: "org-1", name: "Acme Corp", plan: "professional",
    isDemo: false, subscriptionStatus: "trialing",
  },
}

function makeCtx(id = "ob-1") {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCountFn.mockResolvedValue(0)
  mockUserFindMany.mockResolvedValue([])
  mockInvitationFindMany.mockResolvedValue([])
})

// ─── GET /configure/users ─────────────────────────────────────────────────────

describe("GET /configure/users", () => {
  function makeReq() {
    return new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/configure/users")
  }

  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/users/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeReq(), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 404 when onboarding record not found", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/users/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(null)
    const res = await GET(makeReq(), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns users, invitations, and primaryContactEmail", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/users/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      organizationId: "org-1", primaryContactEmail: "alice@acme.com",
    })
    const mockUser = {
      id: "u-1", name: "Alice Smith", email: "alice@acme.com", role: "ADMIN",
      department: null, location: null, createdAt: new Date(), lastLoginAt: null,
    }
    const mockInv = {
      id: "inv-1", email: "bob@acme.com", role: "EMPLOYEE",
      expiresAt: new Date(Date.now() + 86_400_000 * 7),
      createdAt: new Date(), department: null, location: null,
    }
    mockUserFindMany.mockResolvedValue([mockUser])
    mockInvitationFindMany.mockResolvedValue([mockInv])
    const res = await GET(makeReq(), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as {
      users: typeof mockUser[]
      invitations: typeof mockInv[]
      primaryContactEmail: string
    }
    expect(body.users).toHaveLength(1)
    expect(body.users[0].email).toBe("alice@acme.com")
    expect(body.invitations).toHaveLength(1)
    expect(body.invitations[0].email).toBe("bob@acme.com")
    expect(body.primaryContactEmail).toBe("alice@acme.com")
  })

  it("queries users with organizationId from onboarding record (org isolation)", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/users/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      organizationId: "org-99", primaryContactEmail: "contact@other.com",
    })
    mockUserFindMany.mockResolvedValue([])
    mockInvitationFindMany.mockResolvedValue([])
    await GET(makeReq(), makeCtx())
    // Verify user query was scoped to org-99
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-99" }),
      })
    )
  })

  it("includes only active users", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/users/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      organizationId: "org-1", primaryContactEmail: "alice@acme.com",
    })
    mockUserFindMany.mockResolvedValue([])
    await GET(makeReq(), makeCtx())
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })
})

// ─── GET /wizard: dataReadiness ───────────────────────────────────────────────

describe("GET /wizard dataReadiness", () => {
  function makeReq() {
    return new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/wizard")
  }

  it("overview=true when primaryContactEmail and trialStartDate present", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      trialStartDate: new Date("2026-12-01"),
    })
    const res = await GET(makeReq(), makeCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness.overview).toBe(true)
  })

  it("overview=false when trialStartDate is missing", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, trialStartDate: null })
    const res = await GET(makeReq(), makeCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness.overview).toBe(false)
  })

  it("locations=true when locationCount >= 1", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockCountFn
      .mockResolvedValueOnce(1)  // location.count
      .mockResolvedValueOnce(0)  // department.count
      .mockResolvedValueOnce(0)  // employeeType.count
      .mockResolvedValueOnce(0)  // user.count
      .mockResolvedValueOnce(0)  // invitation.count
    const res = await GET(makeReq(), makeCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness.locations).toBe(true)
    expect(body.dataReadiness.departments).toBe(false)
  })

  it("data-driven step status overrides wizardProgress.completedSteps for non-current steps", async () => {
    // locations is in completedSteps but counts say it's empty → should be "incomplete"
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      wizardProgress: {
        currentStepKey: "departments",
        completedSteps: ["locations"],
        skippedSteps:   [],
        lastSavedAt:    null,
      },
    })
    // All counts = 0 (default from beforeEach)
    const res = await GET(makeReq(), makeCtx())
    const body = await res.json() as { steps: Array<{ key: string; status: string }> }
    const byKey = Object.fromEntries(body.steps.map(s => [s.key, s.status]))
    // locations was in completedSteps but count=0 → "incomplete"
    expect(byKey["locations"]).toBe("incomplete")
    // departments is current → stays "current" regardless of data
    expect(byKey["departments"]).toBe("current")
  })

  it("response includes counts object with all five fields", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await GET(makeReq(), makeCtx())
    const body = await res.json() as {
      counts: {
        locationCount: number
        deptCount: number
        empTypeCount: number
        userCount: number
        pendingInviteCount: number
      }
    }
    expect(body.counts).toMatchObject({
      locationCount:    0,
      deptCount:        0,
      empTypeCount:     0,
      userCount:        0,
      pendingInviteCount: 0,
    })
  })
})
