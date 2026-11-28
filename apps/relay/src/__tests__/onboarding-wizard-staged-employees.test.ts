/**
 * Tests for staged employees endpoints (Phase C+).
 *
 * Covers:
 * - GET /configure/staged-employees: SA required, not found, returns staged list + primaryContactEmail
 * - POST /configure/staged-employees: SA required, validates name/email/role, blocks primary contact conflict
 * - POST /configure/staged-employees: blocks duplicate email
 * - POST /configure/staged-employees: creates staged record in wizardProgress (no Invitation row)
 * - POST /configure/staged-employees: post-launch (409) blocked
 * - DELETE /configure/staged-employees/[id]: removes staged employee from wizardProgress
 * - DELETE /configure/staged-employees/[id]: not found when id doesn't exist
 * - PATCH /configure/staged-employees/[id]: updates staged employee
 * - PATCH /configure/staged-employees/[id]: blocks changing email to primary contact email
 * - GET /wizard: employee-list dataReadiness=true only when stagedEmployees.length >= 1
 * - GET /wizard: employee-list=false for existing org users (not wizard-staged)
 * - PATCH /wizard-progress: preserves stagedEmployees when updating step navigation
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only",    () => ({}))
vi.mock("@/lib/session",  () => ({ getSession: vi.fn() }))

const mockOnboardingFindUnique = vi.fn()
const mockOnboardingUpdate     = vi.fn()
const mockAuditCreate          = vi.fn()
const mockCountFn              = vi.fn()
const mockEmpTypeFindUnique    = vi.fn()
const mockDeptFindUnique       = vi.fn()
const mockLocFindUnique        = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: {
      findUnique: (...a: unknown[]) => mockOnboardingFindUnique(...a),
      update:     (...a: unknown[]) => mockOnboardingUpdate(...a),
    },
    configurationAuditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    location:     { count: (...a: unknown[]) => mockCountFn(...a), findUnique: (...a: unknown[]) => mockLocFindUnique(...a) },
    department:   { count: (...a: unknown[]) => mockCountFn(...a), findUnique: (...a: unknown[]) => mockDeptFindUnique(...a) },
    employeeType: { count: (...a: unknown[]) => mockCountFn(...a), findUnique: (...a: unknown[]) => mockEmpTypeFindUnique(...a) },
    user:         { count: (...a: unknown[]) => mockCountFn(...a) },
    invitation:   { count: (...a: unknown[]) => mockCountFn(...a) },
    sOP:          { count: (...a: unknown[]) => mockCountFn(...a) },
    qrCode:       { count: (...a: unknown[]) => mockCountFn(...a) },
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
  status:              "configuring",
  primaryContactEmail: "alice@acme.com",
  wizardProgress:      null,
  organization: {
    id: "org-1", name: "Acme Corp", plan: "professional",
    isDemo: false, subscriptionStatus: "trialing",
  },
}

const STAGED_EMPLOYEE = {
  id:             "emp-uuid-1",
  name:           "Bob Jones",
  email:          "bob@acme.com",
  role:           "EMPLOYEE",
  employeeTypeId: null,
  departmentId:   null,
  locationId:     null,
  managerId:      null,
  createdAt:      "2026-11-22T00:00:00.000Z",
}

function makeCtx(id = "ob-1") {
  return { params: Promise.resolve({ id }) }
}
function makeEmpCtx(id = "ob-1", employeeId = "emp-uuid-1") {
  return { params: Promise.resolve({ id, employeeId }) }
}
function makeReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/super-admin/onboarding/ob-1/configure/staged-employees`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuditCreate.mockResolvedValue({})
  mockOnboardingUpdate.mockResolvedValue({})
  mockCountFn.mockResolvedValue(0)
  mockEmpTypeFindUnique.mockResolvedValue(null)
  mockDeptFindUnique.mockResolvedValue(null)
  mockLocFindUnique.mockResolvedValue(null)
})

// ─── GET /configure/staged-employees ─────────────────────────────────────────

describe("GET /configure/staged-employees", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 404 when onboarding not found", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(null)
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns empty staged list when wizardProgress is null", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      wizardProgress: null, primaryContactEmail: "alice@acme.com",
    })
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { stagedEmployees: unknown[]; primaryContactEmail: string }
    expect(body.stagedEmployees).toEqual([])
    expect(body.primaryContactEmail).toBe("alice@acme.com")
  })

  it("returns existing staged employees from wizardProgress", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      wizardProgress: {
        currentStepKey: "employee-list", completedSteps: [], skippedSteps: [],
        lastSavedAt: null, stagedEmployees: [STAGED_EMPLOYEE],
      },
      primaryContactEmail: "alice@acme.com",
    })
    const res = await GET(makeReq("GET"), makeCtx())
    const body = await res.json() as { stagedEmployees: typeof STAGED_EMPLOYEE[] }
    expect(body.stagedEmployees).toHaveLength(1)
    expect(body.stagedEmployees[0].email).toBe("bob@acme.com")
  })
})

// ─── POST /configure/staged-employees ────────────────────────────────────────

describe("POST /configure/staged-employees", () => {
  it("returns 403 for non-SA", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(null)
    const res = await POST(makeReq("POST", { name: "Bob", email: "bob@acme.com" }), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)      // requireWizardAccess
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null })  // load record
    const res = await POST(makeReq("POST", { email: "bob@acme.com" }), makeCtx())
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/name/i)
  })

  it("returns 409 when email matches primaryContactEmail", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null, primaryContactEmail: "alice@acme.com" })
    const res = await POST(makeReq("POST", { name: "Alice", email: "alice@acme.com" }), makeCtx())
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/primary contact/i)
  })

  it("returns 409 for duplicate email already staged", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: { currentStepKey: null, completedSteps: [], skippedSteps: [], lastSavedAt: null, stagedEmployees: [STAGED_EMPLOYEE] },
        primaryContactEmail: "alice@acme.com",
      })
    const res = await POST(makeReq("POST", { name: "Bob2", email: "bob@acme.com" }), makeCtx())
    expect(res.status).toBe(409)
  })

  it("creates staged employee and updates wizardProgress (no Invitation row)", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null, primaryContactEmail: "alice@acme.com" })
    const res = await POST(makeReq("POST", { name: "Bob Jones", email: "bob@acme.com", role: "SUPERVISOR" }), makeCtx())
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; email: string; role: string }
    expect(body.email).toBe("bob@acme.com")
    expect(body.role).toBe("SUPERVISOR")
    // Verify wizardProgress was updated (no invitation table call)
    expect(mockOnboardingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wizardProgress: expect.objectContaining({
            stagedEmployees: expect.arrayContaining([
              expect.objectContaining({ email: "bob@acme.com", role: "SUPERVISOR" }),
            ]),
          }),
        }),
      })
    )
  })

  it("returns 409 for post-launch status", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "invitation_sent" })
    const res = await POST(makeReq("POST", { name: "Bob", email: "bob@acme.com" }), makeCtx())
    expect(res.status).toBe(409)
  })
})

// ─── DELETE /configure/staged-employees/[id] ─────────────────────────────────

describe("DELETE /configure/staged-employees/[id]", () => {
  it("removes the staged employee and updates wizardProgress", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/[employeeId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: null, completedSteps: [], skippedSteps: [], lastSavedAt: null,
          stagedEmployees: [STAGED_EMPLOYEE],
        },
      })
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, makeEmpCtx("ob-1", "emp-uuid-1"))
    expect(res.status).toBe(200)
    expect(mockOnboardingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wizardProgress: expect.objectContaining({ stagedEmployees: [] }),
        }),
      })
    )
  })

  it("returns 404 when employee id not found", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/[employeeId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({ ...BASE_ONBOARDING, wizardProgress: null })
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, makeEmpCtx("ob-1", "nonexistent"))
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /configure/staged-employees/[id] ──────────────────────────────────

describe("PATCH /configure/staged-employees/[id]", () => {
  it("updates name and role of a staged employee", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/[employeeId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: null, completedSteps: [], skippedSteps: [], lastSavedAt: null,
          stagedEmployees: [STAGED_EMPLOYEE],
        },
        primaryContactEmail: "alice@acme.com",
      })
    const req = new NextRequest("http://localhost/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Robert Jones", role: "MANAGER" }),
    })
    const res = await PATCH(req, makeEmpCtx("ob-1", "emp-uuid-1"))
    expect(res.status).toBe(200)
    const body = await res.json() as { name: string; role: string }
    expect(body.name).toBe("Robert Jones")
    expect(body.role).toBe("MANAGER")
  })

  it("blocks changing email to primary contact email", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/staged-employees/[employeeId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique
      .mockResolvedValueOnce(BASE_ONBOARDING)
      .mockResolvedValueOnce({
        ...BASE_ONBOARDING,
        wizardProgress: {
          currentStepKey: null, completedSteps: [], skippedSteps: [], lastSavedAt: null,
          stagedEmployees: [STAGED_EMPLOYEE],
        },
        primaryContactEmail: "alice@acme.com",
      })
    const req = new NextRequest("http://localhost/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@acme.com" }),
    })
    const res = await PATCH(req, makeEmpCtx("ob-1", "emp-uuid-1"))
    expect(res.status).toBe(409)
  })
})

// ─── GET /wizard: employee-list dataReadiness ─────────────────────────────────

describe("GET /wizard employee-list dataReadiness", () => {
  function makeWizReq() {
    return new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/wizard")
  }
  function makeWizCtx() { return { params: Promise.resolve({ id: "ob-1" }) } }

  const BASE_OB = {
    id: "ob-1", organizationId: "org-1", status: "configuring",
    primaryContactEmail: "alice@acme.com", primaryContactName: "Alice",
    plan: "professional", trialStartDate: null, internalNotes: null,
    wizardProgress: null,
    organization: {
      id: "org-1", name: "Acme Corp", plan: "professional",
      isDemo: false, subscriptionStatus: "trialing",
    },
  }

  it("employee-list=false when no staged employees (even if org users exist)", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_OB,
      wizardProgress: null,  // no staged employees
    })
    // Even if user.count returns 1 (org user exists), should not count
    mockCountFn.mockResolvedValue(1)
    const res = await GET(makeWizReq(), makeWizCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness["employee-list"]).toBe(false)
  })

  it("employee-list=true when stagedEmployees.length >= 1 in wizardProgress", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_OB,
      wizardProgress: {
        currentStepKey: "employee-list", completedSteps: [], skippedSteps: [],
        lastSavedAt: null, stagedEmployees: [STAGED_EMPLOYEE],
      },
    })
    mockCountFn.mockResolvedValue(0)
    const res = await GET(makeWizReq(), makeWizCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness["employee-list"]).toBe(true)
  })
})

// ─── PATCH /wizard-progress: preserves stagedEmployees ───────────────────────

describe("PATCH /wizard-progress preserves stagedEmployees", () => {
  it("retains stagedEmployees when navigating steps", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/wizard-progress/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      wizardProgress: {
        currentStepKey: "employee-list", completedSteps: [], skippedSteps: [],
        lastSavedAt: null, stagedEmployees: [STAGED_EMPLOYEE],
      },
    })
    const req = new NextRequest("http://localhost/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentStepKey: "readiness" }),
    })
    await PATCH(req, { params: Promise.resolve({ id: "ob-1" }) })
    expect(mockOnboardingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wizardProgress: expect.objectContaining({
            stagedEmployees: [STAGED_EMPLOYEE],  // preserved
            currentStepKey: "readiness",
          }),
        }),
      })
    )
  })
})
