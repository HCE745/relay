/**
 * Tests for Sales Manager Rep View — Stage A (manager-rep assignment + read-only shell).
 *
 * Covers:
 * - GET /api/sales/manager/reps: 403 for non-manager; returns team reps for manager; all reps for SA
 * - getManagerRepView: null for unauthenticated
 * - getManagerRepView: null for sales_rep caller (not a manager)
 * - getManagerRepView: null when rep not assigned to this manager
 * - getManagerRepView: valid for assigned rep
 * - getManagerRepView: super-admin can view any rep regardless of managerId
 * - PATCH /api/super-admin/sales-users/[id]: assign_manager action — validation and success
 * - Negative: unassigned manager cannot view rep via direct API (403)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

const mockSalesUserFindUnique = vi.fn()
const mockSalesUserFindMany   = vi.fn()
const mockSalesUserUpdate     = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser: {
      findUnique: (...a: unknown[]) => mockSalesUserFindUnique(...a),
      findMany:   (...a: unknown[]) => mockSalesUserFindMany(...a),
      update:     (...a: unknown[]) => mockSalesUserUpdate(...a),
    },
  },
}))

import { getSession } from "@/lib/session"
import { GET as GET_REPS } from "@/app/api/sales/manager/reps/route"
import { PATCH as PATCH_SALES_USER } from "@/app/api/super-admin/sales-users/[id]/route"
import { getManagerRepView } from "@/lib/manager-rep-auth"

function makeReq(body?: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/test", {
    method: body ? "PATCH" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  })
  return req
}

function params(id: string) {
  return Promise.resolve({ id })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET /api/sales/manager/reps ─────────────────────────────────────────────

describe("GET /api/sales/manager/reps", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_REPS()
    expect(res.status).toBe(403)
  })

  it("returns 403 for sales_rep", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "rep1", salesUserRole: "sales_rep" } as never)
    mockSalesUserFindUnique.mockResolvedValue({ isActive: true, role: "sales_rep", name: "Rep", isDemo: false })
    const res = await GET_REPS()
    expect(res.status).toBe(403)
  })

  it("returns only manager's assigned reps", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "mgr1", salesUserRole: "admin_sales" } as never)
    mockSalesUserFindUnique.mockResolvedValue({ isActive: true, role: "admin_sales", name: "Manager", isDemo: false })
    mockSalesUserFindMany.mockResolvedValue([
      { id: "rep1", name: "Alice", email: "alice@co.com", sessions: [] },
    ])
    const res = await GET_REPS()
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
    // Verify the query filtered by managerId
    const whereArg = mockSalesUserFindMany.mock.calls[0][0].where
    expect(whereArg).toMatchObject({ managerId: "mgr1", role: "sales_rep", isActive: true })
  })

  it("super-admin sees all reps (no managerId filter)", async () => {
    vi.mocked(getSession).mockResolvedValue({ superAdmin: true } as never)
    mockSalesUserFindMany.mockResolvedValue([
      { id: "rep1", name: "Alice", email: "alice@co.com", sessions: [] },
      { id: "rep2", name: "Bob",   email: "bob@co.com",   sessions: [] },
    ])
    const res = await GET_REPS()
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(2)
    const whereArg = mockSalesUserFindMany.mock.calls[0][0].where
    expect(whereArg).not.toHaveProperty("managerId")
  })
})

// ─── getManagerRepView ────────────────────────────────────────────────────────

describe("getManagerRepView", () => {
  it("returns null for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const result = await getManagerRepView("rep1")
    expect(result).toBeNull()
  })

  it("returns null for sales_rep caller", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "rep1", salesUserRole: "sales_rep" } as never)
    mockSalesUserFindUnique.mockResolvedValue({ isActive: true, role: "sales_rep", name: "Rep", isDemo: false })
    const result = await getManagerRepView("rep2")
    expect(result).toBeNull()
  })

  it("returns null when target rep not assigned to this manager", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "mgr1", salesUserRole: "admin_sales" } as never)
    // getSalesSession internal findUnique
    mockSalesUserFindUnique
      .mockResolvedValueOnce({ isActive: true, role: "admin_sales", name: "Manager", isDemo: false })
      // getManagerRepView findUnique for the rep
      .mockResolvedValueOnce({ id: "rep1", name: "Alice", email: "a@co.com", role: "sales_rep", isActive: true, managerId: "mgr99" })
    const result = await getManagerRepView("rep1")
    expect(result).toBeNull()
  })

  it("returns null for non-existent rep", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "mgr1", salesUserRole: "admin_sales" } as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce({ isActive: true, role: "admin_sales", name: "Manager", isDemo: false })
      .mockResolvedValueOnce(null)
    const result = await getManagerRepView("rep-missing")
    expect(result).toBeNull()
  })

  it("returns ManagerRepViewInfo for assigned rep", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "mgr1", salesUserRole: "admin_sales" } as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce({ isActive: true, role: "admin_sales", name: "Manager", isDemo: false })
      .mockResolvedValueOnce({ id: "rep1", name: "Alice", email: "a@co.com", role: "sales_rep", isActive: true, managerId: "mgr1" })
    const result = await getManagerRepView("rep1")
    expect(result).not.toBeNull()
    expect(result?.viewingRep.id).toBe("rep1")
    expect(result?.isReadOnly).toBe(true)
  })

  it("super-admin can view any rep regardless of managerId", async () => {
    vi.mocked(getSession).mockResolvedValue({ superAdmin: true } as never)
    mockSalesUserFindUnique.mockResolvedValue({
      id: "rep1", name: "Alice", email: "a@co.com", role: "sales_rep", isActive: true, managerId: "some-other-mgr",
    })
    const result = await getManagerRepView("rep1")
    expect(result).not.toBeNull()
    expect(result?.session.isSuperAdmin).toBe(true)
  })
})

// ─── PATCH /api/super-admin/sales-users/[id]: assign_manager ─────────────────

describe("PATCH /super-admin/sales-users/[id] — assign_manager", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ superAdmin: true } as never)
  })

  it("returns 400 when managerId not provided", async () => {
    mockSalesUserFindUnique.mockResolvedValue({ id: "rep1", role: "sales_rep" })
    const req = makeReq({ action: "assign_manager" })
    const res = await PATCH_SALES_USER(req, { params: params("rep1") })
    expect(res.status).toBe(400)
  })

  it("returns 400 when target is not a sales_rep", async () => {
    mockSalesUserFindUnique.mockResolvedValue({ id: "mgr2", role: "admin_sales" })
    const req = makeReq({ action: "assign_manager", managerId: "mgr1" })
    const res = await PATCH_SALES_USER(req, { params: params("mgr2") })
    expect(res.status).toBe(400)
  })

  it("returns 400 when target manager doesn't exist or isn't admin_sales", async () => {
    mockSalesUserFindUnique
      .mockResolvedValueOnce({ id: "rep1", role: "sales_rep" })  // the target rep
      .mockResolvedValueOnce(null)                               // the manager lookup
    const req = makeReq({ action: "assign_manager", managerId: "nonexistent" })
    const res = await PATCH_SALES_USER(req, { params: params("rep1") })
    expect(res.status).toBe(400)
  })

  it("successfully assigns manager", async () => {
    mockSalesUserFindUnique
      .mockResolvedValueOnce({ id: "rep1", role: "sales_rep" })
      .mockResolvedValueOnce({ role: "admin_sales", isActive: true })
    mockSalesUserUpdate.mockResolvedValue({ id: "rep1", name: "Alice", email: "a@co.com", role: "sales_rep", managerId: "mgr1" })
    const req = makeReq({ action: "assign_manager", managerId: "mgr1" })
    const res = await PATCH_SALES_USER(req, { params: params("rep1") })
    expect(res.status).toBe(200)
    const data = await res.json() as { managerId: string }
    expect(data.managerId).toBe("mgr1")
  })

  it("successfully unassigns manager (null)", async () => {
    mockSalesUserFindUnique.mockResolvedValue({ id: "rep1", role: "sales_rep" })
    mockSalesUserUpdate.mockResolvedValue({ id: "rep1", name: "Alice", email: "a@co.com", role: "sales_rep", managerId: null })
    const req = makeReq({ action: "assign_manager", managerId: null })
    const res = await PATCH_SALES_USER(req, { params: params("rep1") })
    expect(res.status).toBe(200)
    const data = await res.json() as { managerId: null }
    expect(data.managerId).toBeNull()
  })
})
