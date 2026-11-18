/**
 * Tests for white-glove customer onboarding routes.
 *
 * Covers:
 * - POST /onboarding: creates org + onboarding, requires super-admin
 * - POST /onboarding: duplicate prevention (email, in-progress record)
 * - GET /onboarding/[id]: returns record or 404
 * - PATCH /onboarding/[id]: fields, status transitions, checklist toggle
 * - PATCH /onboarding/[id]: live records are read-only
 * - PATCH /onboarding/[id]: invitation_sent blocks field edits
 * - PATCH /onboarding/[id]: invitation_sent → live transition allowed
 * - POST /onboarding/[id]/launch: validation (wrong status, missing trial date)
 * - POST /onboarding/[id]/launch: checklist warning (422) + force launch
 * - POST /onboarding/[id]/launch: creates invitation, activates trial, marks invitation_sent
 * - POST /onboarding/[id]/launch: idempotency (already launched → 409)
 * - POST /onboarding/[id]/launch: existing user account blocks launch (409)
 * - POST /onboarding/[id]/resend-invitation: resends or rotates token
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

const mockFindMany            = vi.fn()
const mockFindUnique          = vi.fn()
const mockFindFirst           = vi.fn()
const mockCreate              = vi.fn()
const mockUpdate              = vi.fn()
const mockTx                  = vi.fn()
const mockInvitationFindUnique = vi.fn()
const mockInvitationUpdateMany = vi.fn()
const mockInvitationCreate    = vi.fn()
const mockUserFindUnique      = vi.fn()

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
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    invitation: {
      create:      (...a: unknown[]) => mockInvitationCreate(...a),
      findUnique:  (...a: unknown[]) => mockInvitationFindUnique(...a),
      updateMany:  (...a: unknown[]) => mockInvitationUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSession } from "@/lib/session"
import { GET as LIST, POST as CREATE } from "@/app/api/super-admin/onboarding/route"
import { GET, PATCH } from "@/app/api/super-admin/onboarding/[id]/route"
import { POST as LAUNCH } from "@/app/api/super-admin/onboarding/[id]/launch/route"
import { POST as RESEND } from "@/app/api/super-admin/onboarding/[id]/resend-invitation/route"

const mockGetSession = vi.mocked(getSession)

const SA_SESSION = { superAdmin: true, superAdminId: "sa-1", name: "Admin User", email: "admin@relay.com" }

function jsonReq(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("https://test.example/api/", {
    method,
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

const BASE_ONBOARDING = {
  id:                  "ob-1",
  organizationId:      "org-1",
  status:              "ready_to_launch",
  primaryContactName:  "Jane Smith",
  primaryContactEmail: "jane@acme.com",
  plan:                "essentials",
  estimatedFacilities: 2,
  internalNotes:       null,
  ownerId:             "sa-1",
  ownerName:           "Admin User",
  checklist:           [
    { key: "org_details",    label: "Org details", completedAt: "2026-01-01T00:00:00Z", completedByName: "Admin" },
    { key: "trial_date",     label: "Trial date",  completedAt: "2026-01-01T00:00:00Z", completedByName: "Admin" },
    { key: "internal_review",label: "Review done", completedAt: "2026-01-01T00:00:00Z", completedByName: "Admin" },
  ],
  trialStartDate:   "2026-11-20T00:00:00Z",
  launchedAt:       null,
  invitationSentAt: null,
  invitationToken:  null,
  createdAt:        "2026-11-01T00:00:00Z",
  updatedAt:        "2026-11-01T00:00:00Z",
  organization: {
    id: "org-1", name: "Acme Co", slug: "acme-co", plan: "essentials",
    subscriptionStatus: "draft", trialStartDate: null, trialEndsAt: null, createdAt: "2026-11-01T00:00:00Z",
  },
}

// ─── POST /onboarding (CREATE) ────────────────────────────────────────────────

describe("POST /onboarding", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for unauthenticated requests", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await CREATE(jsonReq({ companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com" }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when companyName is missing", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const res = await CREATE(jsonReq({ primaryContactName: "Jane", primaryContactEmail: "jane@co.com" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid email", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const res = await CREATE(jsonReq({ companyName: "Acme", primaryContactName: "Jane", primaryContactEmail: "not-an-email" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when contact email already has a user account", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockUserFindUnique.mockResolvedValue({ id: "u-1" })
    const res = await CREATE(jsonReq({ companyName: "Acme", primaryContactName: "Jane", primaryContactEmail: "jane@acme.com" }))
    expect(res.status).toBe(409)
  })

  it("returns 409 when active onboarding already exists for email", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockUserFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue({ id: "ob-existing" })
    const res = await CREATE(jsonReq({ companyName: "Acme", primaryContactName: "Jane", primaryContactEmail: "jane@acme.com" }))
    expect(res.status).toBe(409)
  })

  it("creates org and onboarding record on success", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockUserFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    const fakeOrg = { id: "org-new", name: "Acme", slug: "acme-123", subscriptionStatus: "draft", plan: "essentials" }
    const fakeOb  = { id: "ob-new", organizationId: "org-new", status: "draft", primaryContactEmail: "jane@acme.com" }
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        organization:       { create: vi.fn().mockResolvedValue(fakeOrg) },
        customerOnboarding: { create: vi.fn().mockResolvedValue(fakeOb) },
      }
      return fn(tx)
    })
    const res = await CREATE(jsonReq({
      companyName:         "Acme",
      primaryContactName:  "Jane Smith",
      primaryContactEmail: "jane@acme.com",
      plan:                "essentials",
      estimatedFacilities: 2,
    }))
    expect(res.status).toBe(201)
    const data = await res.json() as { onboarding: { id: string } }
    expect(data.onboarding.id).toBe("ob-new")
  })
})

// ─── GET /onboarding/[id] ─────────────────────────────────────────────────────

describe("GET /onboarding/[id]", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(new NextRequest("https://test.example/"), params("ob-1"))
    expect(res.status).toBe(403)
  })

  it("returns 404 for missing record", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest("https://test.example/"), params("ob-nope"))
    expect(res.status).toBe(404)
  })

  it("returns onboarding with organization", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(BASE_ONBOARDING)
    const res = await GET(new NextRequest("https://test.example/"), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { id: string }
    expect(data.id).toBe("ob-1")
  })
})

// ─── PATCH /onboarding/[id] ───────────────────────────────────────────────────

describe("PATCH /onboarding/[id]", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await PATCH(jsonReq({ status: "configuring" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(403)
  })

  it("returns 404 for missing record", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(null)
    const res = await PATCH(jsonReq({ status: "configuring" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(404)
  })

  it("returns 409 for live onboarding records", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "live" })
    const res = await PATCH(jsonReq({ internalNotes: "edit" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(409)
  })

  it("allows valid status transition draft→configuring", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "draft", organization: { id: "org-1", name: "Acme Co" } })
    mockUpdate.mockResolvedValue({ ...BASE_ONBOARDING, status: "configuring" })
    const res = await PATCH(jsonReq({ status: "configuring" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "configuring" }),
    }))
  })

  it("rejects transition to live via PATCH when not in invitation_sent", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "ready_to_launch", organization: { id: "org-1", name: "Acme Co" } })
    const res = await PATCH(jsonReq({ status: "live" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(400)
  })

  it("allows invitation_sent → live transition via PATCH", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      status: "invitation_sent",
      invitationSentAt: "2026-11-15T00:00:00Z",
      organization: { id: "org-1", name: "Acme Co" },
    })
    mockUpdate.mockResolvedValue({ ...BASE_ONBOARDING, status: "live" })
    const res = await PATCH(jsonReq({ status: "live" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "live" }),
    }))
  })

  it("blocks field edits when status is invitation_sent", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      status: "invitation_sent",
      invitationSentAt: "2026-11-15T00:00:00Z",
      organization: { id: "org-1", name: "Acme Co" },
    })
    const res = await PATCH(jsonReq({ internalNotes: "changed after send" }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(409)
  })

  it("toggles a checklist item on", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    const draft = {
      ...BASE_ONBOARDING,
      status: "configuring",
      checklist: [{ key: "org_details", label: "Org details", completedAt: null, completedByName: null }],
      organization: { id: "org-1", name: "Acme Co" },
    }
    mockFindUnique.mockResolvedValue(draft)
    mockUpdate.mockResolvedValue({ ...draft, checklist: [{ key: "org_details", label: "Org details", completedAt: "2026-11-17T00:00:00Z", completedByName: "Admin User" }] })
    const res = await PATCH(jsonReq({ checklistToggle: { key: "org_details", completed: true } }, "PATCH"), params("ob-1"))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        checklist: expect.arrayContaining([
          expect.objectContaining({ key: "org_details", completedByName: "Admin User" }),
        ]),
      }),
    }))
  })
})

// ─── POST /onboarding/[id]/launch ─────────────────────────────────────────────

describe("POST /onboarding/[id]/launch", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await LAUNCH(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(403)
  })

  it("returns 404 for missing record", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(null)
    const res = await LAUNCH(jsonReq({}), params("ob-nope"))
    expect(res.status).toBe(404)
  })

  it("returns 409 when already live", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "live", invitationSentAt: "2026-01-01" })
    const res = await LAUNCH(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(409)
  })

  it("returns 400 when status is not ready_to_launch", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "configuring" })
    const res = await LAUNCH(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when trial start date is missing", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, trialStartDate: null })
    const res = await LAUNCH(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(400)
  })

  it("returns 422 with incomplete checklist warning (without force)", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      checklist: [
        { key: "org_details", label: "Org details", completedAt: null, completedByName: null },
        { key: "trial_date",  label: "Trial date",  completedAt: "2026-01-01T00:00:00Z", completedByName: "Admin" },
      ],
    })
    mockUserFindUnique.mockResolvedValue(null)
    const res = await LAUNCH(jsonReq({ force: false }), params("ob-1"))
    expect(res.status).toBe(422)
    const data = await res.json() as { incomplete: string[]; canForce: boolean }
    expect(data.incomplete).toContain("Org details")
    expect(data.canForce).toBe(true)
  })

  it("returns 409 when contact email already has a user account", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockUserFindUnique.mockResolvedValue({ id: "u-existing" })
    const res = await LAUNCH(jsonReq({ force: true }), params("ob-1"))
    expect(res.status).toBe(409)
  })

  it("successfully launches: creates invitation, activates trial, marks invitation_sent (not live)", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(BASE_ONBOARDING)
    mockUserFindUnique.mockResolvedValue(null)
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        invitation:         { create: vi.fn() },
        organization:       { update: vi.fn() },
        customerOnboarding: { update: vi.fn() },
      }
      await fn(tx)
      expect(tx.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "jane@acme.com",
            role:  "ADMIN",
          }),
        }),
      )
      expect(tx.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionStatus: "trialing" }),
        }),
      )
      // Status must be invitation_sent, NOT live — activation is a separate step
      expect(tx.customerOnboarding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "invitation_sent" }),
        }),
      )
    })
    const res = await LAUNCH(jsonReq({ force: true }), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; status: string; trialStartDate: string; trialEndsAt: string }
    expect(data.ok).toBe(true)
    expect(data.status).toBe("invitation_sent")
    // Trial must be calculated from trialStartDate, not from now
    expect(data.trialStartDate).toBe(new Date("2026-11-20T00:00:00Z").toISOString())
  })

  it("returns 409 if invitation was already sent (invitationSentAt set)", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({
      ...BASE_ONBOARDING,
      invitationSentAt: "2026-11-01T00:00:00Z",
    })
    mockUserFindUnique.mockResolvedValue(null)
    const res = await LAUNCH(jsonReq({ force: true }), params("ob-1"))
    expect(res.status).toBe(409)
  })
})

// ─── POST /onboarding/[id]/resend-invitation ──────────────────────────────────

const INVITATION_SENT_ONBOARDING = {
  ...BASE_ONBOARDING,
  status:           "invitation_sent",
  invitationSentAt: "2026-11-15T00:00:00Z",
  invitationToken:  "existing-token-uuid",
}

describe("POST /onboarding/[id]/resend-invitation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 403 for unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(403)
  })

  it("returns 404 for missing record", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(null)
    const res = await RESEND(jsonReq({}), params("ob-nope"))
    expect(res.status).toBe(404)
  })

  it("returns 400 when status is not invitation_sent", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue({ ...BASE_ONBOARDING, status: "ready_to_launch" })
    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(400)
  })

  it("returns 409 when contact already has a user account", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(INVITATION_SENT_ONBOARDING)
    mockUserFindUnique.mockResolvedValue({ id: "u-exists" })
    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(409)
  })

  it("reuses valid token and resends email", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(INVITATION_SENT_ONBOARDING)
    mockUserFindUnique.mockResolvedValue(null)
    // Invitation is still valid
    mockInvitationFindUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 7 * 86400000),
      usedAt:    null,
    })
    mockUpdate.mockResolvedValue({})
    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; freshInvitation: boolean }
    expect(data.ok).toBe(true)
    expect(data.freshInvitation).toBe(false)
    // Should NOT have called $transaction (no token rotation needed)
    expect(mockTx).not.toHaveBeenCalled()
  })

  it("rotates expired token without creating duplicate org or re-activating trial", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION as never)
    mockFindUnique.mockResolvedValue(INVITATION_SENT_ONBOARDING)
    mockUserFindUnique.mockResolvedValue(null)
    // Invitation is expired
    mockInvitationFindUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 86400000), // yesterday
      usedAt:    null,
    })
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        invitation:         { updateMany: vi.fn(), create: vi.fn() },
        customerOnboarding: { update: vi.fn() },
      }
      await fn(tx)
      // Must expire old invitation and create new one — no org.create call
      expect(tx.invitation.updateMany).toHaveBeenCalled()
      expect(tx.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "jane@acme.com",
            role:  "ADMIN",
          }),
        }),
      )
      // Must NOT touch organization (no trial re-activation)
      expect((tx as unknown as { organization?: unknown }).organization).toBeUndefined()
    })
    const res = await RESEND(jsonReq({}), params("ob-1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; freshInvitation: boolean }
    expect(data.ok).toBe(true)
    expect(data.freshInvitation).toBe(true)
  })
})
