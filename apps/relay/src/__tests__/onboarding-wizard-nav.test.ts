/**
 * Tests for Phase B: wizard GET + wizard-progress PATCH endpoints.
 *
 * Covers:
 * - GET /wizard: SA required, record not found, correct step statuses (fresh/in-progress)
 * - PATCH /wizard-progress: SA required (403), post-launch blocked (409), not found (404)
 * - PATCH /wizard-progress: advances status draft → configuring on first open
 * - PATCH /wizard-progress: markCompleted updates completed set, removes from skipped
 * - PATCH /wizard-progress: markSkipped updates skipped set, removes from completed
 * - PATCH /wizard-progress: unmarkStep removes from both sets
 * - PATCH /wizard-progress: validates step key
 * - PATCH /wizard-progress: no-op returns 400
 * - Resume: GET returns currentStepKey from saved wizardProgress
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockOnboardingFindUnique = vi.fn()
const mockOnboardingUpdate     = vi.fn()
const mockAuditCreate          = vi.fn()
const mockCountZero            = vi.fn().mockResolvedValue(0)

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: {
      findUnique: (...a: unknown[]) => mockOnboardingFindUnique(...a),
      update:     (...a: unknown[]) => mockOnboardingUpdate(...a),
    },
    configurationAuditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    location:     { count: (...a: unknown[]) => mockCountZero(...a) },
    department:   { count: (...a: unknown[]) => mockCountZero(...a) },
    employeeType: { count: (...a: unknown[]) => mockCountZero(...a) },
    user:         { count: (...a: unknown[]) => mockCountZero(...a) },
    invitation:   { count: (...a: unknown[]) => mockCountZero(...a) },
  },
}))

import { getSession } from "@/lib/session"
const mockGetSession = getSession as ReturnType<typeof vi.fn>

const SA_SESSION = {
  superAdmin: true, superAdminId: "sa-1", name: "Will Hunt",
  userId: null, organizationId: null, salesUserId: null, role: null,
}

const BASE_ONBOARDING = {
  id: "ob-1",
  organizationId: "org-1",
  status: "configuring",
  primaryContactName:  "Alice Smith",
  primaryContactEmail: "alice@acme.com",
  plan: "professional",
  trialStartDate: null,
  wizardProgress: null,
  organization: {
    id: "org-1", name: "Acme Corp", plan: "professional",
    isDemo: false, subscriptionStatus: "trialing",
  },
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/wizard", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeCtx(id = "ob-1") {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuditCreate.mockResolvedValue({})
  mockOnboardingUpdate.mockResolvedValue({})
  mockCountZero.mockResolvedValue(0)
})

// ─── GET /wizard ──────────────────────────────────────────────────────────────

describe("GET /wizard", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 404 when not found", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(null)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns all 11 steps with correct structure for fresh wizard", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { steps: Array<{ key: string; status: string }>; totalSteps: number; completedCount: number }
    expect(body.totalSteps).toBe(11)
    expect(body.steps).toHaveLength(11)
    expect(body.completedCount).toBe(0)
    // Fresh wizard: first step is current, rest are incomplete
    expect(body.steps[0].status).toBe("current")
    expect(body.steps[1].status).toBe("incomplete")
    expect(body.steps[10].status).toBe("incomplete")
  })

  it("returns correct step statuses for in-progress wizard", async () => {
    // Phase C: data-driven steps (overview, locations) derive completion from real data counts,
    // not from wizardProgress.completedSteps. Set up data so both are truly complete.
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    // overview is complete: primaryContactEmail + trialStartDate present
    // locations is complete: mockCountZero overridden to return 1 for location
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      trialStartDate: new Date("2026-12-01"),
      wizardProgress: {
        currentStepKey: "departments",
        completedSteps: ["overview", "locations"],
        skippedSteps:   ["sops"],
        lastSavedAt:    "2026-11-22T00:00:00.000Z",
      },
    })
    // Mock location count = 1 so locations step shows completed
    mockCountZero.mockResolvedValueOnce(1) // location.count
      .mockResolvedValueOnce(0)            // department.count
      .mockResolvedValueOnce(0)            // employeeType.count
      .mockResolvedValueOnce(0)            // user.count
      .mockResolvedValueOnce(0)            // invitation.count
    const res = await GET(makeRequest("GET"), makeCtx())
    const body = await res.json() as { steps: Array<{ key: string; status: string }>; completedCount: number }
    expect(body.completedCount).toBe(2)
    const byKey = Object.fromEntries(body.steps.map(s => [s.key, s.status]))
    expect(byKey["overview"]).toBe("completed")
    expect(byKey["locations"]).toBe("completed")
    expect(byKey["departments"]).toBe("current")
    expect(byKey["sops"]).toBe("skipped")
    expect(byKey["qr-codes"]).toBe("incomplete")
  })

  it("returns correct organizationName and plan in header fields", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await GET(makeRequest("GET"), makeCtx())
    const body = await res.json() as { organizationName: string; plan: string; primaryContactEmail: string }
    expect(body.organizationName).toBe("Acme Corp")
    expect(body.plan).toBe("professional")
    expect(body.primaryContactEmail).toBe("alice@acme.com")
  })

  it("marks isPostLaunch=true for invitation_sent status", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "invitation_sent" })
    const res = await GET(makeRequest("GET"), makeCtx())
    const body = await res.json() as { isPostLaunch: boolean }
    expect(body.isPostLaunch).toBe(true)
  })

  it("marks isPostLaunch=false for configuring status", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await GET(makeRequest("GET"), makeCtx())
    const body = await res.json() as { isPostLaunch: boolean }
    expect(body.isPostLaunch).toBe(false)
  })

  it("resume: currentStepKey from saved progress is used", async () => {
    // Phase C: data-driven steps derive completion from counts, not wizardProgress.completedSteps.
    // Mock all data-driven steps as having data (counts > 0, trialStartDate set).
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      trialStartDate: new Date("2026-12-01"),
      wizardProgress: {
        currentStepKey: "feature-flags",
        completedSteps: ["overview", "locations", "departments", "employee-types", "issue-settings", "notifications", "sops", "qr-codes"],
        skippedSteps:   [],
        lastSavedAt:    "2026-11-22T10:00:00Z",
      },
    })
    // All data-driven counts > 0 so overview/locations/departments/employee-types show completed
    mockCountZero
      .mockResolvedValueOnce(1)  // location.count
      .mockResolvedValueOnce(1)  // department.count
      .mockResolvedValueOnce(1)  // employeeType.count
      .mockResolvedValueOnce(0)  // user.count (employee-list not in completedSteps)
      .mockResolvedValueOnce(0)  // invitation.count
    const res = await GET(makeRequest("GET"), makeCtx())
    const body = await res.json() as { progress: { currentStepKey: string }; completedCount: number }
    expect(body.progress.currentStepKey).toBe("feature-flags")
    expect(body.completedCount).toBe(8)
  })
})

// ─── PATCH /wizard-progress ───────────────────────────────────────────────────

describe("PATCH /wizard-progress", () => {
  it("returns 403 for non-SA", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(null)
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "locations" }), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 404 when not found", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce({ ...BASE_ONBOARDING })  // requireWizardAccess
      .mockResolvedValueOnce(null)                     // second lookup
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "locations" }), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns 409 when status is invitation_sent (post-launch)", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "invitation_sent" })
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "locations" }), makeCtx())
    expect(res.status).toBe(409)
  })

  it("returns 400 for invalid step key", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "bogus-step" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("returns 400 when no changes provided", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await PATCH(makeRequest("PATCH", {}), makeCtx())
    expect(res.status).toBe(400)
  })

  it("auto-advances status from draft to configuring on first open", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, status: "draft" })   // requireWizardAccess
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, status: "draft", wizardProgress: null })
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "overview" }), makeCtx())
    expect(res.status).toBe(200)
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { status?: string; wizardProgress: unknown } }
    expect(updateArg.data.status).toBe("configuring")
    const body = await res.json() as { statusAdvanced: string | null }
    expect(body.statusAdvanced).toBe("configuring")
  })

  it("does NOT advance status when already configuring", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null })
    await PATCH(makeRequest("PATCH", { currentStepKey: "locations" }), makeCtx())
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { status?: string } }
    expect(updateArg.data.status).toBeUndefined()
  })

  it("markCompleted adds to completedSteps and removes from skippedSteps", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: "departments",
          completedSteps: [],
          skippedSteps:   ["locations"],
          lastSavedAt:    null,
        },
      })
    const res = await PATCH(makeRequest("PATCH", { markCompleted: "locations" }), makeCtx())
    expect(res.status).toBe(200)
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { wizardProgress: { completedSteps: string[]; skippedSteps: string[] } } }
    expect(updateArg.data.wizardProgress.completedSteps).toContain("locations")
    expect(updateArg.data.wizardProgress.skippedSteps).not.toContain("locations")
  })

  it("markSkipped adds to skippedSteps and removes from completedSteps", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: "departments",
          completedSteps: ["sops"],
          skippedSteps:   [],
          lastSavedAt:    null,
        },
      })
    const res = await PATCH(makeRequest("PATCH", { markSkipped: "sops" }), makeCtx())
    expect(res.status).toBe(200)
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { wizardProgress: { completedSteps: string[]; skippedSteps: string[] } } }
    expect(updateArg.data.wizardProgress.skippedSteps).toContain("sops")
    expect(updateArg.data.wizardProgress.completedSteps).not.toContain("sops")
  })

  it("unmarkStep removes from both completed and skipped", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: "feature-flags",
          completedSteps: ["overview", "locations"],
          skippedSteps:   ["sops"],
          lastSavedAt:    null,
        },
      })
    const res = await PATCH(makeRequest("PATCH", { unmarkStep: "locations" }), makeCtx())
    expect(res.status).toBe(200)
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { wizardProgress: { completedSteps: string[]; skippedSteps: string[] } } }
    expect(updateArg.data.wizardProgress.completedSteps).not.toContain("locations")
    expect(updateArg.data.wizardProgress.skippedSteps).not.toContain("locations")
    // other steps untouched
    expect(updateArg.data.wizardProgress.completedSteps).toContain("overview")
    expect(updateArg.data.wizardProgress.skippedSteps).toContain("sops")
  })

  it("persists currentStepKey and writes audit log", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null })
    const res = await PATCH(makeRequest("PATCH", { currentStepKey: "departments" }), makeCtx())
    expect(res.status).toBe(200)
    const updateArg = mockOnboardingUpdate.mock.calls[0][0] as { data: { wizardProgress: { currentStepKey: string } } }
    expect(updateArg.data.wizardProgress.currentStepKey).toBe("departments")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
    const auditArg = mockAuditCreate.mock.calls[0][0] as { data: { source: string; operationType: string; sessionId: string } }
    expect(auditArg.data.source).toBe("wizard")
    expect(auditArg.data.operationType).toBe("UPDATE_WIZARD_PROGRESS")
    expect(auditArg.data.sessionId).toBe("ob-1")
  })
})
