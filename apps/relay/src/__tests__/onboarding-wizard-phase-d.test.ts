/**
 * Phase D regression tests covering:
 * - GET/POST /configure/routing-rules — SA required, creates rule, org isolation
 * - DELETE /configure/routing-rules/[ruleId] — not found, removes rule
 * - GET/POST /configure/escalations — creates chain with steps
 * - PATCH/DELETE /configure/escalations/[chainId] — updates/removes chain
 * - PATCH/DELETE /configure/qr-codes/[qrId] — org isolation, updates, removes
 * - PATCH/DELETE /configure/sops/[sopId] — org isolation, updates, removes
 * - GET /wizard: sopCount + qrCodeCount in counts; sops/qr-codes in dataReadiness
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only",   () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockOBFindUnique    = vi.fn()
const mockOBUpdate        = vi.fn()
const mockAuditCreate     = vi.fn()
const mockRuleCreate      = vi.fn()
const mockRuleDelete      = vi.fn()
const mockRuleFindUnique  = vi.fn()
const mockRuleUpdate      = vi.fn()
const mockRuleFindMany    = vi.fn()
const mockChainCreate     = vi.fn()
const mockChainDelete     = vi.fn()
const mockChainFindUnique = vi.fn()
const mockChainUpdate     = vi.fn()
const mockChainFindMany   = vi.fn()
const mockQrFindUnique    = vi.fn()
const mockQrUpdate        = vi.fn()
const mockQrDelete        = vi.fn()
const mockSopFindUnique   = vi.fn()
const mockSopUpdate       = vi.fn()
const mockSopDelete       = vi.fn()
const mockCountFn         = vi.fn()
const mockLocFindUnique   = vi.fn()
const mockDeptFindUnique  = vi.fn()
const mockUserFindUnique  = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerOnboarding: {
      findUnique: (...a: unknown[]) => mockOBFindUnique(...a),
      update:     (...a: unknown[]) => mockOBUpdate(...a),
    },
    configurationAuditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    routingRule: {
      findMany:   (...a: unknown[]) => mockRuleFindMany(...a),
      findUnique: (...a: unknown[]) => mockRuleFindUnique(...a),
      create:     (...a: unknown[]) => mockRuleCreate(...a),
      update:     (...a: unknown[]) => mockRuleUpdate(...a),
      delete:     (...a: unknown[]) => mockRuleDelete(...a),
    },
    escalationChain: {
      findMany:   (...a: unknown[]) => mockChainFindMany(...a),
      findUnique: (...a: unknown[]) => mockChainFindUnique(...a),
      create:     (...a: unknown[]) => mockChainCreate(...a),
      update:     (...a: unknown[]) => mockChainUpdate(...a),
      delete:     (...a: unknown[]) => mockChainDelete(...a),
    },
    qrCode: {
      findMany:   (...a: unknown[]) => mockCountFn(...a),
      findUnique: (...a: unknown[]) => mockQrFindUnique(...a),
      update:     (...a: unknown[]) => mockQrUpdate(...a),
      delete:     (...a: unknown[]) => mockQrDelete(...a),
      count:      (...a: unknown[]) => mockCountFn(...a),
    },
    sOP: {
      findMany:   (...a: unknown[]) => mockCountFn(...a),
      findUnique: (...a: unknown[]) => mockSopFindUnique(...a),
      update:     (...a: unknown[]) => mockSopUpdate(...a),
      delete:     (...a: unknown[]) => mockSopDelete(...a),
      count:      (...a: unknown[]) => mockCountFn(...a),
    },
    location:   { findMany: vi.fn(), findUnique: (...a: unknown[]) => mockLocFindUnique(...a), count: (...a: unknown[]) => mockCountFn(...a) },
    department: { findMany: vi.fn(), findUnique: (...a: unknown[]) => mockDeptFindUnique(...a), count: (...a: unknown[]) => mockCountFn(...a) },
    employeeType: { count: (...a: unknown[]) => mockCountFn(...a) },
    user:         { count: (...a: unknown[]) => mockCountFn(...a), findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    invitation:   { count: (...a: unknown[]) => mockCountFn(...a) },
  },
}))

import { getSession } from "@/lib/session"
const mockGetSession = getSession as ReturnType<typeof vi.fn>

const SA_SESSION = {
  superAdmin: true, superAdminId: "sa-1", name: "Will Hunt",
  userId: null, organizationId: null, salesUserId: null, role: null,
}

const BASE_OB = {
  id: "ob-1", organizationId: "org-1", status: "configuring",
  primaryContactEmail: "ceo@acme.com",
  organization: { id: "org-1", name: "Acme", plan: "professional", isDemo: false, subscriptionStatus: "trialing" },
}

function makeCtx(id = "ob-1") {
  return { params: Promise.resolve({ id }) }
}
function makeRuleCtx(id = "ob-1", ruleId = "rule-1") {
  return { params: Promise.resolve({ id, ruleId }) }
}
function makeChainCtx(id = "ob-1", chainId = "chain-1") {
  return { params: Promise.resolve({ id, chainId }) }
}
function makeQrCtx(id = "ob-1", qrId = "qr-1") {
  return { params: Promise.resolve({ id, qrId }) }
}
function makeSopCtx(id = "ob-1", sopId = "sop-1") {
  return { params: Promise.resolve({ id, sopId }) }
}

function makeReq(method: string, body?: unknown, url = "http://localhost/") {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body:    body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuditCreate.mockResolvedValue({})
  mockCountFn.mockResolvedValue(0)
  mockLocFindUnique.mockResolvedValue(null)
  mockDeptFindUnique.mockResolvedValue(null)
  mockUserFindUnique.mockResolvedValue(null)
  mockOBUpdate.mockResolvedValue({})
})

// ─── routing-rules ────────────────────────────────────────────────────────────

describe("GET /configure/routing-rules", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns routing rules list", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue({ organizationId: "org-1" })
    mockRuleFindMany.mockResolvedValue([{ id: "rule-1", name: "Safety → Manager" }])
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(body).toHaveLength(1)
  })
})

describe("POST /configure/routing-rules", () => {
  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    const res = await POST(makeReq("POST", { assignToRole: "MANAGER" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("returns 400 when neither assignToRole nor assignToUserId provided", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    const res = await POST(makeReq("POST", { name: "Safety rule" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates a routing rule with org isolation", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockRuleCreate.mockResolvedValue({ id: "rule-1", name: "Safety → Manager", condCategory: "SAFETY", assignToRole: "MANAGER" })
    const res = await POST(makeReq("POST", { name: "Safety → Manager", condCategory: "SAFETY", assignToRole: "MANAGER" }), makeCtx())
    expect(res.status).toBe(201)
    const body = await res.json() as { name: string }
    expect(body.name).toBe("Safety → Manager")
  })

  it("rejects condLocationId from different org", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockLocFindUnique.mockResolvedValue({ organizationId: "org-other" })
    const res = await POST(makeReq("POST", { name: "X", condLocationId: "loc-other", assignToRole: "MANAGER" }), makeCtx())
    expect(res.status).toBe(400)
  })
})

describe("DELETE /configure/routing-rules/[ruleId]", () => {
  it("returns 404 for rule not in org", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/[ruleId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockRuleFindUnique.mockResolvedValue(null)
    const res = await DELETE(makeReq("DELETE"), makeRuleCtx())
    expect(res.status).toBe(404)
  })

  it("deletes the routing rule", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/routing-rules/[ruleId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockRuleFindUnique.mockResolvedValue({ organizationId: "org-1", name: "Safety → Manager" })
    mockRuleDelete.mockResolvedValue({})
    const res = await DELETE(makeReq("DELETE"), makeRuleCtx())
    expect(res.status).toBe(200)
    expect(mockRuleDelete).toHaveBeenCalledWith({ where: { id: "rule-1" } })
  })
})

// ─── escalations ─────────────────────────────────────────────────────────────

describe("GET /configure/escalations", () => {
  it("returns 403 for non-SA", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/route")
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(403)
  })

  it("returns escalation chains list", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue({ organizationId: "org-1" })
    mockChainFindMany.mockResolvedValue([{ id: "chain-1", name: "Critical Chain", steps: [] }])
    const res = await GET(makeReq("GET"), makeCtx())
    expect(res.status).toBe(200)
  })
})

describe("POST /configure/escalations", () => {
  it("returns 400 when name missing", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    const res = await POST(makeReq("POST", { triggerPriority: "HIGH" }), makeCtx())
    expect(res.status).toBe(400)
  })

  it("creates an escalation chain with steps", async () => {
    const { POST } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockChainCreate.mockResolvedValue({
      id: "chain-1", name: "Critical Escalation", triggerPriority: "CRITICAL", hoursToFirst: 4,
      steps: [{ id: "step-1", stepOrder: 1, role: "MANAGER", notifyVia: "EMAIL", hoursAfterPrevious: 4 }],
    })
    const res = await POST(makeReq("POST", {
      name: "Critical Escalation", triggerPriority: "CRITICAL", hoursToFirst: 4,
      steps: [{ stepOrder: 1, role: "MANAGER", notifyVia: "EMAIL", hoursAfterPrevious: 4 }],
    }), makeCtx())
    expect(res.status).toBe(201)
    const body = await res.json() as { name: string; steps: unknown[] }
    expect(body.name).toBe("Critical Escalation")
    expect(body.steps).toHaveLength(1)
  })
})

describe("DELETE /configure/escalations/[chainId]", () => {
  it("returns 404 for chain not in org", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/[chainId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockChainFindUnique.mockResolvedValue(null)
    const res = await DELETE(makeReq("DELETE"), makeChainCtx())
    expect(res.status).toBe(404)
  })

  it("deletes escalation chain", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/escalations/[chainId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockChainFindUnique.mockResolvedValue({ organizationId: "org-1", name: "Critical Chain" })
    mockChainDelete.mockResolvedValue({})
    const res = await DELETE(makeReq("DELETE"), makeChainCtx())
    expect(res.status).toBe(200)
  })
})

// ─── qr-codes/[qrId] ─────────────────────────────────────────────────────────

describe("PATCH /configure/qr-codes/[qrId]", () => {
  it("returns 404 for QR code not in org", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/[qrId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockQrFindUnique.mockResolvedValue(null)
    const res = await PATCH(makeReq("PATCH", { name: "Updated" }), makeQrCtx())
    expect(res.status).toBe(404)
  })

  it("rejects locationId from different org", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/[qrId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockQrFindUnique.mockResolvedValue({ organizationId: "org-1", name: "Dock QR" })
    mockLocFindUnique.mockResolvedValue({ organizationId: "org-other" })
    const res = await PATCH(makeReq("PATCH", { locationId: "loc-other" }), makeQrCtx())
    expect(res.status).toBe(400)
  })

  it("updates QR code", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/[qrId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockQrFindUnique.mockResolvedValue({ organizationId: "org-1", name: "Dock QR" })
    mockQrUpdate.mockResolvedValue({ id: "qr-1", name: "Updated Name" })
    const res = await PATCH(makeReq("PATCH", { name: "Updated Name" }), makeQrCtx())
    expect(res.status).toBe(200)
  })
})

describe("DELETE /configure/qr-codes/[qrId]", () => {
  it("returns 404 for QR not found", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/[qrId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockQrFindUnique.mockResolvedValue(null)
    const res = await DELETE(makeReq("DELETE"), makeQrCtx())
    expect(res.status).toBe(404)
  })

  it("deletes the QR code", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/qr-codes/[qrId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockQrFindUnique.mockResolvedValue({ organizationId: "org-1", name: "Dock QR" })
    mockQrDelete.mockResolvedValue({})
    const res = await DELETE(makeReq("DELETE"), makeQrCtx())
    expect(res.status).toBe(200)
    expect(mockQrDelete).toHaveBeenCalledWith({ where: { id: "qr-1" } })
  })
})

// ─── sops/[sopId] ─────────────────────────────────────────────────────────────

describe("PATCH /configure/sops/[sopId]", () => {
  it("returns 404 for SOP not in org", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/[sopId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockSopFindUnique.mockResolvedValue(null)
    const res = await PATCH(makeReq("PATCH", { title: "Updated SOP" }), makeSopCtx())
    expect(res.status).toBe(404)
  })

  it("updates SOP title", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/[sopId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockSopFindUnique.mockResolvedValue({ organizationId: "org-1", title: "Old Title" })
    mockSopUpdate.mockResolvedValue({ id: "sop-1", title: "Updated SOP" })
    const res = await PATCH(makeReq("PATCH", { title: "Updated SOP" }), makeSopCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { title: string }
    expect(body.title).toBe("Updated SOP")
  })

  it("blocks post-launch writes", async () => {
    const { PATCH } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/[sopId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue({ ...BASE_OB, status: "invitation_sent" })
    const res = await PATCH(makeReq("PATCH", { title: "Changed" }), makeSopCtx())
    expect(res.status).toBe(409)
  })
})

describe("DELETE /configure/sops/[sopId]", () => {
  it("deletes the SOP", async () => {
    const { DELETE } = await import("@/app/api/super-admin/onboarding/[id]/configure/sops/[sopId]/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB)
    mockSopFindUnique.mockResolvedValue({ organizationId: "org-1", title: "Old SOP" })
    mockSopDelete.mockResolvedValue({})
    const res = await DELETE(makeReq("DELETE"), makeSopCtx())
    expect(res.status).toBe(200)
    expect(mockSopDelete).toHaveBeenCalledWith({ where: { id: "sop-1" } })
  })
})

// ─── GET /wizard: sopCount + qrCodeCount in counts and dataReadiness ───────────

describe("GET /wizard Phase D dataReadiness", () => {
  function makeWizReq() {
    return new NextRequest("http://localhost/api/super-admin/onboarding/ob-1/wizard")
  }
  function makeWizCtx() { return { params: Promise.resolve({ id: "ob-1" }) } }

  const BASE_OB_WIZ = {
    id: "ob-1", organizationId: "org-1", status: "configuring",
    primaryContactEmail: "ceo@acme.com", primaryContactName: "CEO",
    plan: "professional", trialStartDate: null, internalNotes: null,
    wizardProgress: null,
    organization: { id: "org-1", name: "Acme", plan: "professional", isDemo: false, subscriptionStatus: "trialing" },
  }

  it("sops=false when sopCount=0", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB_WIZ)
    mockCountFn.mockResolvedValue(0)
    const res = await GET(makeWizReq(), makeWizCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean> }
    expect(body.dataReadiness["sops"]).toBe(false)
    expect(body.dataReadiness["qr-codes"]).toBe(false)
  })

  it("sops=true when sopCount>=1 and qr-codes=true when qrCodeCount>=1", async () => {
    const { GET } = await import("@/app/api/super-admin/onboarding/[id]/wizard/route")
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockOBFindUnique.mockResolvedValue(BASE_OB_WIZ)
    mockCountFn.mockResolvedValue(1)
    const res = await GET(makeWizReq(), makeWizCtx())
    const body = await res.json() as { dataReadiness: Record<string, boolean>; counts: Record<string, number> }
    expect(body.dataReadiness["sops"]).toBe(true)
    expect(body.dataReadiness["qr-codes"]).toBe(true)
    expect(body.counts.sopCount).toBe(1)
    expect(body.counts.qrCodeCount).toBe(1)
  })
})
