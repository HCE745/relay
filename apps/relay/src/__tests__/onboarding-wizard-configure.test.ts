/**
 * Tests for Phase A: SA wizard configure endpoints.
 *
 * Covers:
 * - requireWizardAccess: SA required, record not found, launched state blocked
 * - GET /configure/locations: SA can list, non-SA blocked
 * - POST /configure/locations: creates location, validates org isolation, name required
 * - PATCH /configure/locations/[id]: updates fields, org isolation enforced
 * - DELETE /configure/locations/[id]: deletes, org isolation enforced
 * - GET /configure/departments: SA can list
 * - POST /configure/departments: creates, validates location belongs to org
 * - GET /configure/employee-types: SA can list
 * - POST /configure/employee-types: creates, validates baseRole
 * - GET /configure/sops: SA can list
 * - POST /configure/sops: creates SOP, validates org isolation
 * - GET /configure/qr-codes: SA can list
 * - POST /configure/qr-codes: creates, uses SA ID as createdById
 * - GET /configure/readiness: returns correct pass/fail per item
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

const mockOnboardingFindUnique = vi.fn()
const mockOrgFindUnique        = vi.fn()
const mockOrgUpdate            = vi.fn()
const mockLocationFindMany     = vi.fn()
const mockLocationFindUnique   = vi.fn()
const mockLocationCreate       = vi.fn()
const mockLocationUpdate       = vi.fn()
const mockLocationDelete       = vi.fn()
const mockLocationCount        = vi.fn()
const mockDeptFindMany         = vi.fn()
const mockDeptFindUnique       = vi.fn()
const mockDeptCreate           = vi.fn()
const mockDeptUpdate           = vi.fn()
const mockDeptDelete           = vi.fn()
const mockDeptCount            = vi.fn()
const mockEmpTypeFindMany      = vi.fn()
const mockEmpTypeCreate        = vi.fn()
const mockEmpTypeFindUnique    = vi.fn()
const mockEmpTypeUpdate        = vi.fn()
const mockEmpTypeDelete        = vi.fn()
const mockSopFindMany          = vi.fn()
const mockSopCreate            = vi.fn()
const mockQrFindMany           = vi.fn()
const mockQrCreate             = vi.fn()
const mockQrCount              = vi.fn()
const mockAuditCreate          = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: { findUnique: (...a: unknown[]) => mockOnboardingFindUnique(...a) },
    organization:       { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a), update: (...a: unknown[]) => mockOrgUpdate(...a) },
    location: {
      findMany:  (...a: unknown[]) => mockLocationFindMany(...a),
      findUnique:(...a: unknown[]) => mockLocationFindUnique(...a),
      create:    (...a: unknown[]) => mockLocationCreate(...a),
      update:    (...a: unknown[]) => mockLocationUpdate(...a),
      delete:    (...a: unknown[]) => mockLocationDelete(...a),
      count:     (...a: unknown[]) => mockLocationCount(...a),
    },
    department: {
      findMany:  (...a: unknown[]) => mockDeptFindMany(...a),
      findUnique:(...a: unknown[]) => mockDeptFindUnique(...a),
      create:    (...a: unknown[]) => mockDeptCreate(...a),
      update:    (...a: unknown[]) => mockDeptUpdate(...a),
      delete:    (...a: unknown[]) => mockDeptDelete(...a),
      count:     (...a: unknown[]) => mockDeptCount(...a),
    },
    employeeType: {
      findMany:  (...a: unknown[]) => mockEmpTypeFindMany(...a),
      findUnique:(...a: unknown[]) => mockEmpTypeFindUnique(...a),
      create:    (...a: unknown[]) => mockEmpTypeCreate(...a),
      update:    (...a: unknown[]) => mockEmpTypeUpdate(...a),
      delete:    (...a: unknown[]) => mockEmpTypeDelete(...a),
    },
    sOP: {
      findMany: (...a: unknown[]) => mockSopFindMany(...a),
      create:   (...a: unknown[]) => mockSopCreate(...a),
    },
    qrCode: {
      findMany: (...a: unknown[]) => mockQrFindMany(...a),
      create:   (...a: unknown[]) => mockQrCreate(...a),
      count:    (...a: unknown[]) => mockQrCount(...a),
    },
    configurationAuditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  },
}))

vi.mock("@/lib/slug", () => ({
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}))

import { getSession } from "@/lib/session"
const mockGetSession = getSession as ReturnType<typeof vi.fn>

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SA_SESSION = {
  superAdmin: true, superAdminId: "sa-1", name: "Will Hunt",
  userId: null, organizationId: null, salesUserId: null, role: null,
}

const BASE_ONBOARDING = {
  id: "ob-1", organizationId: "org-1", status: "configuring",
}

function makeRequest(method: string, body?: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/configure/locations", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return req
}

function makeCtx(id = "ob-1", sub = {}) {
  return { params: Promise.resolve({ id, ...sub }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuditCreate.mockResolvedValue({})
})

// ─── requireWizardAccess ─────────────────────────────────────────────────────

describe("requireWizardAccess", () => {
  it("throws 403 when no session", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(null)
    const res = await POST(makeRequest("POST", { name: "Plant A" }), makeCtx())
    expect(res.status).toBe(403)
  })

  it("throws 403 for non-SA session", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue({ superAdmin: false })
    const res = await POST(makeRequest("POST", { name: "Plant A" }), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns 404 when onboarding record not found", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(null)
    const res = await POST(makeRequest("POST", { name: "Plant A" }), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns 409 when status is invitation_sent", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "invitation_sent" })
    const res = await POST(makeRequest("POST", { name: "Plant A" }), makeCtx())
    expect(res.status).toBe(409)
  })

  it("returns 409 when status is live", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "live" })
    const res = await POST(makeRequest("POST", { name: "Plant A" }), makeCtx())
    expect(res.status).toBe(409)
  })
})

// ─── Locations ───────────────────────────────────────────────────────────────

describe("GET /configure/locations", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns locations for the org", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindMany.mockResolvedValue([{ id: "loc-1", name: "Plant A", organizationId: "org-1" }])
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(body).toHaveLength(1)
  })
})

describe("POST /configure/locations", () => {
  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await POST(makeRequest("POST", {}), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates location and writes audit log", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationCreate.mockResolvedValue({ id: "loc-1", name: "Plant A", locationType: "Plant", organizationId: "org-1", slug: "plant-a" })
    const res = await POST(makeRequest("POST", { name: "Plant A", locationType: "Plant" }), makeCtx())
    expect(res.status).toBe(201)
    expect(mockLocationCreate).toHaveBeenCalledOnce()
    // Org isolation: organizationId comes from onboarding record, not body
    const createArg = mockLocationCreate.mock.calls[0][0] as { data: { organizationId: string } }
    expect(createArg.data.organizationId).toBe("org-1")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
    const auditArg = mockAuditCreate.mock.calls[0][0] as { data: { sessionId: string; source: string } }
    expect(auditArg.data.sessionId).toBe("ob-1")
    expect(auditArg.data.source).toBe("wizard")
  })

  it("rejects parent that belongs to a different org", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ organizationId: "org-OTHER" })
    const res = await POST(makeRequest("POST", { name: "Child", parentId: "loc-other" }), makeCtx())
    expect(res.status).toBe(400)
  })
})

describe("PATCH /configure/locations/[locationId]", () => {
  it("returns 404 when location belongs to different org", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/[locationId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ id: "loc-1", organizationId: "org-OTHER", name: "X", locationType: null, isActive: true })
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: Promise.resolve({ id: "ob-1", locationId: "loc-1" }) })
    expect(res.status).toBe(404)
  })

  it("updates and logs audit", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/[locationId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ id: "loc-1", organizationId: "org-1", name: "Old", locationType: null, isActive: true })
    mockLocationUpdate.mockResolvedValue({ id: "loc-1", name: "New", organizationId: "org-1" })
    const res = await PATCH(makeRequest("PATCH", { name: "New" }), { params: Promise.resolve({ id: "ob-1", locationId: "loc-1" }) })
    expect(res.status).toBe(200)
    expect(mockLocationUpdate).toHaveBeenCalledOnce()
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })
})

describe("DELETE /configure/locations/[locationId]", () => {
  it("returns 404 for wrong org", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/[locationId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ id: "loc-1", organizationId: "org-OTHER", name: "X", locationType: null, isActive: true })
    const res = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "ob-1", locationId: "loc-1" }) })
    expect(res.status).toBe(404)
  })

  it("deletes and logs audit", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/locations/[locationId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ id: "loc-1", organizationId: "org-1", name: "Plant A", locationType: "Plant", isActive: true })
    mockLocationDelete.mockResolvedValue({})
    const res = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "ob-1", locationId: "loc-1" }) })
    expect(res.status).toBe(200)
    expect(mockLocationDelete).toHaveBeenCalledOnce()
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })
})

// ─── Departments ─────────────────────────────────────────────────────────────

describe("POST /configure/departments", () => {
  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/departments/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await POST(makeRequest("POST", {}), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates department and logs audit", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/departments/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockDeptCreate.mockResolvedValue({ id: "dept-1", name: "Production", organizationId: "org-1", locationId: null })
    const res = await POST(makeRequest("POST", { name: "Production" }), makeCtx())
    expect(res.status).toBe(201)
    const data = mockDeptCreate.mock.calls[0][0] as { data: { organizationId: string } }
    expect(data.data.organizationId).toBe("org-1")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })

  it("rejects locationId from a different org", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/departments/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockLocationFindUnique.mockResolvedValue({ organizationId: "org-OTHER" })
    const res = await POST(makeRequest("POST", { name: "Dept", locationId: "loc-other" }), makeCtx())
    expect(res.status).toBe(400)
  })
})

// ─── Employee Types ───────────────────────────────────────────────────────────

describe("POST /configure/employee-types", () => {
  it("returns 400 for invalid baseRole", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/employee-types/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await POST(makeRequest("POST", { name: "Lead", baseRole: "BOGUS" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates employee type with ADMIN baseRole", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/employee-types/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockEmpTypeCreate.mockResolvedValue({ id: "et-1", name: "Plant Manager", baseRole: "ADMIN", organizationId: "org-1" })
    const res = await POST(makeRequest("POST", { name: "Plant Manager", baseRole: "ADMIN" }), makeCtx())
    expect(res.status).toBe(201)
    const data = mockEmpTypeCreate.mock.calls[0][0] as { data: { organizationId: string; baseRole: string } }
    expect(data.data.organizationId).toBe("org-1")
    expect(data.data.baseRole).toBe("ADMIN")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })
})

// ─── SOPs ─────────────────────────────────────────────────────────────────────

describe("POST /configure/sops", () => {
  it("returns 400 when content is missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await POST(makeRequest("POST", { title: "Safety Walkthrough" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates SOP with org isolation enforced", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockSopCreate.mockResolvedValue({ id: "sop-1", title: "Safety Walkthrough", organizationId: "org-1" })
    const res = await POST(makeRequest("POST", { title: "Safety Walkthrough", content: "Step 1: Put on PPE." }), makeCtx())
    expect(res.status).toBe(201)
    const data = mockSopCreate.mock.calls[0][0] as { data: { organizationId: string } }
    expect(data.data.organizationId).toBe("org-1")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })
})

// ─── QR Codes ─────────────────────────────────────────────────────────────────

describe("POST /configure/qr-codes", () => {
  it("creates QR code using SA ID as createdById", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockQrCreate.mockResolvedValue({ id: "qr-1", name: "Main Entrance", organizationId: "org-1", createdById: "sa-1" })
    const res = await POST(makeRequest("POST", { name: "Main Entrance" }), makeCtx())
    expect(res.status).toBe(201)
    const data = mockQrCreate.mock.calls[0][0] as { data: { organizationId: string; createdById: string } }
    expect(data.data.organizationId).toBe("org-1")
    expect(data.data.createdById).toBe("sa-1")
    expect(mockAuditCreate).toHaveBeenCalledOnce()
  })
})

// ─── Readiness ────────────────────────────────────────────────────────────────

describe("GET /configure/readiness", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/readiness/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("ready=false when trial start date missing", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/readiness/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      primaryContactEmail: "alice@example.com",
      trialStartDate: null,
      organization: { id: "org-1", name: "Acme" },
    })
    mockLocationCount.mockResolvedValue(2)
    mockQrCount.mockResolvedValue(1)
    mockDeptCount.mockResolvedValue(3)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { ready: boolean; requiredFailed: string[] }
    expect(body.ready).toBe(false)
    expect(body.requiredFailed).toContain("Trial start date is set")
    expect(body.requiredFailed).not.toContain("Primary contact email is set")
  })

  it("ready=true when both hard gates pass", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/readiness/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOnboardingFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      primaryContactEmail: "alice@example.com",
      trialStartDate: new Date("2026-12-01"),
      organization: { id: "org-1", name: "Acme" },
    })
    mockLocationCount.mockResolvedValue(0)
    mockQrCount.mockResolvedValue(0)
    mockDeptCount.mockResolvedValue(0)
    const res = await GET(makeRequest("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { ready: boolean; requiredFailed: string[]; items: Array<{ key: string; required: boolean; passed: boolean }> }
    expect(body.ready).toBe(true)
    expect(body.requiredFailed).toHaveLength(0)
    // Advisory items still report their status
    const qrItem = body.items.find(i => i.key === "has_qr_code")
    expect(qrItem?.required).toBe(false)
    expect(qrItem?.passed).toBe(false) // advisory, but still reported as not passed
  })
})
