import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks (must be before the route import) ───────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/research-list-auth", async () => {
  const actual = await import("@/lib/research-list-auth")
  return { ...actual, getResearchIdentity: vi.fn() }
})

vi.mock("@/lib/sales-auth", () => ({
  getSalesSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospectResearchList:    { findUnique: vi.fn() },
    prospectResearchResult:  { findMany: vi.fn(), update: vi.fn() },
    prospect:                { create: vi.fn(), update: vi.fn() },
    accountAssignmentHistory:{ create: vi.fn() },
  },
}))

vi.mock("@/lib/prospect-utils", () => ({
  findDuplicateProspect: vi.fn(),
}))

import { getSalesSession } from "@/lib/sales-auth"
import { getResearchIdentity } from "@/lib/research-list-auth"
import { prisma } from "@/lib/prisma"
import { findDuplicateProspect } from "@/lib/prospect-utils"
import { POST } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/promote/route"

// Clear all mock state between tests so spy call counts don't accumulate.
beforeEach(() => { vi.clearAllMocks() })

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REP_A = { salesUserId: "rep_a", salesUserName: "Alice", isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: false, salesUserRole: "sales_rep" }
const REP_B = { salesUserId: "rep_b", salesUserName: "Bob",   isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: false, salesUserRole: "sales_rep" }
const SA    = { salesUserId: "sa",    salesUserName: "Super Admin", isSuperAdmin: true, isManager: true, isRep: false, isDemo: false, isCrmImpersonation: false, salesUserRole: "super_admin" }

const LIST_OWNED_BY_REP_A = { salesUserId: "rep_a", superAdminId: null, isShared: false }

const RESULT_ACME = {
  id:          "res_acme",
  listId:      "list_1",
  companyName: "Acme Mfg",
  website:     "https://acmemfg.com",
  industry:    "Metal Fabrication",
  verifiedCity:  "Fort Wayne",
  verifiedState: "IN",
  summary:    "Precision metal parts for automotive OEMs.",
  painPoints:  ["shift handoffs", "maintenance backlog"],
  relayFitReasons: ["large shop floor", "multiple shifts"],
  outreachAngle: "Reduce shift changeover time",
  fitScore:    85,
  prospectId:  null,
}

function makeRequest(resultIds: string[]): NextRequest {
  return new NextRequest("https://app.test/api/.../promote", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ resultIds }),
  })
}

function makeParams(id = "list_1") {
  return { params: Promise.resolve({ id }) }
}

// ── Helpers to reset common mocks ─────────────────────────────────────────────

function setupListAndResults() {
  vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(LIST_OWNED_BY_REP_A as never)
  vi.mocked(prisma.prospectResearchResult.findMany).mockResolvedValue([RESULT_ACME] as never)
  vi.mocked(prisma.prospectResearchResult.update).mockResolvedValue({} as never)
  vi.mocked(prisma.accountAssignmentHistory.create).mockResolvedValue({} as never)
}

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — auth", () => {
  it("returns 403 when no session", async () => {
    vi.mocked(getSalesSession).mockResolvedValue(null)
    vi.mocked(getResearchIdentity).mockResolvedValue(null)
    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(403)
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — successful promotion by rep", () => {
  beforeEach(() => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_A)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_a", superAdminId: null, isCrmImpersonation: false })
    setupListAndResults()
    vi.mocked(findDuplicateProspect).mockResolvedValue(null) // no existing match
    vi.mocked(prisma.prospect.create).mockResolvedValue({ id: "prospect_new" } as never)
  })

  it("creates Prospect assigned to the promoting rep", async () => {
    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)

    const createCall = vi.mocked(prisma.prospect.create).mock.calls[0][0]
    expect(createCall.data.assignedToId).toBe("rep_a")
    expect(createCall.data.assignedToName).toBe("Alice")
  })

  it("records ownership in AccountAssignmentHistory", async () => {
    await POST(makeRequest(["res_acme"]), makeParams())

    const histCall = vi.mocked(prisma.accountAssignmentHistory.create).mock.calls[0][0]
    expect(histCall.data.newOwnerId).toBe("rep_a")
    expect(histCall.data.previousOwnerId).toBeNull()
    expect(histCall.data.reason).toBe("promoted_from_research")
    expect(histCall.data.changedByType).toBe("SALES_USER")
  })

  it("links the ResearchResult to the new Prospect", async () => {
    await POST(makeRequest(["res_acme"]), makeParams())

    const updateCall = vi.mocked(prisma.prospectResearchResult.update).mock.calls[0][0]
    expect(updateCall.where.id).toBe("res_acme")
    expect(updateCall.data.prospectId).toBe("prospect_new")
    expect(updateCall.data.promotedAt).toBeInstanceOf(Date)
  })

  it("returns promoted array with resultId → prospectId", async () => {
    const res = await POST(makeRequest(["res_acme"]), makeParams())
    const body = await res.json() as { promoted: Array<{ resultId: string; prospectId: string }> }
    expect(body.promoted).toHaveLength(1)
    expect(body.promoted[0].resultId).toBe("res_acme")
    expect(body.promoted[0].prospectId).toBe("prospect_new")
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — duplicate domain detection", () => {
  beforeEach(() => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_A)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_a", superAdminId: null, isCrmImpersonation: false })
    setupListAndResults()
  })

  it("reuses an existing Prospect that matches by domain (no new Prospect created)", async () => {
    const existingByDomain = {
      id: "prospect_existing", companyName: "Acme Manufacturing LLC",
      assignedToId: null, assignedToName: null, currentCrmStatus: "researched",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(existingByDomain)
    vi.mocked(prisma.prospect.update).mockResolvedValue({} as never)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)

    expect(prisma.prospect.create).not.toHaveBeenCalled()

    const updateCall = vi.mocked(prisma.prospectResearchResult.update).mock.calls[0][0]
    expect(updateCall.data.prospectId).toBe("prospect_existing")
  })

  it("assigns the rep as owner when existing Prospect is unowned", async () => {
    const unowned = {
      id: "prospect_existing", companyName: "Acme Mfg",
      assignedToId: null, assignedToName: null, currentCrmStatus: "researched",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(unowned)
    vi.mocked(prisma.prospect.update).mockResolvedValue({} as never)

    await POST(makeRequest(["res_acme"]), makeParams())

    const prospectUpdate = vi.mocked(prisma.prospect.update).mock.calls[0][0]
    expect(prospectUpdate.data.assignedToId).toBe("rep_a")
    expect(prospectUpdate.data.assignedToName).toBe("Alice")

    const histCall = vi.mocked(prisma.accountAssignmentHistory.create).mock.calls[0][0]
    expect(histCall.data.newOwnerId).toBe("rep_a")
  })

  it("does not reassign if the rep already owns the existing Prospect", async () => {
    const ownedBySelf = {
      id: "prospect_existing", companyName: "Acme Mfg",
      assignedToId: "rep_a", assignedToName: "Alice", currentCrmStatus: "contacted",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(ownedBySelf)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)

    // prospect.update should NOT be called (no ownership change needed)
    expect(prisma.prospect.update).not.toHaveBeenCalled()
    // history entry should NOT be created (no assignment change)
    expect(prisma.accountAssignmentHistory.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — alternate company name match", () => {
  it("reuses an existing Prospect found by normalised name when no domain match", async () => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_A)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_a", superAdminId: null, isCrmImpersonation: false })
    setupListAndResults()

    // findDuplicateProspect found it by name normalisation (no domain in its data)
    const existingByName = {
      id: "prospect_name_match", companyName: "Acme Manufacturing Inc",
      assignedToId: null, assignedToName: null, currentCrmStatus: "researched",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(existingByName)
    vi.mocked(prisma.prospect.update).mockResolvedValue({} as never)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)

    expect(prisma.prospect.create).not.toHaveBeenCalled()

    const updateCall = vi.mocked(prisma.prospectResearchResult.update).mock.calls[0][0]
    expect(updateCall.data.prospectId).toBe("prospect_name_match")
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — ownership conflict (two salesperson accounts)", () => {
  it("returns 409 when Rep B tries to promote a company already owned by Rep A", async () => {
    // Rep B is trying to promote
    vi.mocked(getSalesSession).mockResolvedValue(REP_B)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_b", superAdminId: null, isCrmImpersonation: false })

    // Rep B's list (or shared list they can access)
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(
      { salesUserId: "rep_b", superAdminId: null, isShared: false } as never
    )
    vi.mocked(prisma.prospectResearchResult.findMany).mockResolvedValue([RESULT_ACME] as never)

    // The company is already owned by Rep A
    const ownedByRepA = {
      id: "prospect_rep_a", companyName: "Acme Mfg",
      assignedToId: "rep_a", assignedToName: "Alice", currentCrmStatus: "contacted",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(ownedByRepA)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(409)

    const body = await res.json() as { error: string; message: string; conflictingProspectId: string }
    expect(body.error).toBe("conflict")
    expect(body.conflictingProspectId).toBe("prospect_rep_a")
    expect(body.message).toContain("already assigned")

    // No Prospect or history records should be created on a conflict
    expect(prisma.prospect.create).not.toHaveBeenCalled()
    expect(prisma.accountAssignmentHistory.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — super-admin bypass", () => {
  beforeEach(() => {
    vi.mocked(getSalesSession).mockResolvedValue(SA)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: null, superAdminId: "sa_record_id", isCrmImpersonation: false })
    // SA-owned list
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(
      { salesUserId: null, superAdminId: "sa_record_id", isShared: false } as never
    )
    vi.mocked(prisma.prospectResearchResult.findMany).mockResolvedValue([RESULT_ACME] as never)
    vi.mocked(prisma.prospectResearchResult.update).mockResolvedValue({} as never)
    vi.mocked(prisma.accountAssignmentHistory.create).mockResolvedValue({} as never)
  })

  it("SA creates an unassigned Prospect (no assignedToId)", async () => {
    vi.mocked(findDuplicateProspect).mockResolvedValue(null)
    vi.mocked(prisma.prospect.create).mockResolvedValue({ id: "prospect_sa_new" } as never)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)

    const createCall = vi.mocked(prisma.prospect.create).mock.calls[0][0]
    expect(createCall.data.assignedToId).toBeNull()
    expect(createCall.data.assignedToName).toBeNull()
  })

  it("SA does not write an AccountAssignmentHistory entry when creating unassigned", async () => {
    vi.mocked(findDuplicateProspect).mockResolvedValue(null)
    vi.mocked(prisma.prospect.create).mockResolvedValue({ id: "prospect_sa_new" } as never)

    await POST(makeRequest(["res_acme"]), makeParams())

    expect(prisma.accountAssignmentHistory.create).not.toHaveBeenCalled()
  })

  it("SA can promote a company already assigned to another rep (no 409)", async () => {
    const ownedByRep = {
      id: "prospect_owned", companyName: "Acme Mfg",
      assignedToId: "rep_a", assignedToName: "Alice", currentCrmStatus: "contacted",
    }
    vi.mocked(findDuplicateProspect).mockResolvedValue(ownedByRep)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(200)
    // SA links the result but does not change ownership
    expect(prisma.prospect.update).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════

describe("promote route — access control", () => {
  it("returns 404 when list does not exist", async () => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_A)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_a", superAdminId: null, isCrmImpersonation: false })
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(404)
  })

  it("returns 403 when rep tries to access another rep's private list", async () => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_B) // Rep B
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_b", superAdminId: null, isCrmImpersonation: false })
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(
      { salesUserId: "rep_a", superAdminId: null, isShared: false } as never // Rep A's list
    )

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when rep tries to promote from a shared list they don't own", async () => {
    // isShared is a display/metadata flag and does NOT grant promote access to non-owners
    vi.mocked(getSalesSession).mockResolvedValue(REP_B)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_b", superAdminId: null, isCrmImpersonation: false })
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(
      { salesUserId: "rep_a", superAdminId: null, isShared: true } as never // shared but not owned by REP_B
    )

    const res = await POST(makeRequest(["res_acme"]), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 400 for empty resultIds", async () => {
    vi.mocked(getSalesSession).mockResolvedValue(REP_A)
    vi.mocked(getResearchIdentity).mockResolvedValue({ salesUserId: "rep_a", superAdminId: null, isCrmImpersonation: false })
    vi.mocked(prisma.prospectResearchList.findUnique).mockResolvedValue(LIST_OWNED_BY_REP_A as never)

    const res = await POST(makeRequest([]), makeParams())
    expect(res.status).toBe(400)
  })
})
