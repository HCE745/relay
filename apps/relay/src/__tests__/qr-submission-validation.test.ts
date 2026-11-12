/**
 * QR submission upload validation tests.
 * Verifies MIME-type allowlisting and file-size enforcement on the public
 * QR code report endpoint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    qrCode:          { findUnique: vi.fn() },
    qrCodeSubmission: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    user:            { findFirst: vi.fn() },
    issue:           { create: vi.fn() },
    attachment:      { createMany: vi.fn() },
    issueHistory:    { create: vi.fn() },
    notification:    { create: vi.fn() },
  },
}))

vi.mock("@/lib/ratelimit", () => ({
  checkLimit: vi.fn().mockResolvedValue(null),
  getIP:      vi.fn().mockReturnValue("127.0.0.1"),
  limiters:   { qrReport: "qr-limiter" },
}))

vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.vercel-storage.com/test.jpg" }),
}))

vi.mock("@/lib/routing", () => ({
  autoRouteIssue: vi.fn().mockResolvedValue({ userId: null, ruleName: null }),
}))

import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/report/[token]/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_QR = {
  id:                 "qr-1",
  organizationId:     "org-1",
  isActive:           true,
  name:               "Front Entrance",
  area:               null,
  defaultCategory:    "GENERAL",
  locationId:         null,
  departmentId:       null,
  assetId:            null,
  collectContactInfo: false,
  requireContactInfo: false,
  requirePhoto:       false,
  reportingMode:      "STANDARD",
  routingMode:        "AUTO",
  assignedToId:       null,
  assignedTo:         null,
}

function makeFormRequest(token: string, file: File, fields: Record<string, string> = {}) {
  const form = new FormData()
  form.set("title",       fields.title ?? "Test issue")
  form.set("description", fields.description ?? "Test description")
  form.set("photo",       file)
  for (const [k, v] of Object.entries(fields)) form.set(k, v)

  return new NextRequest(`http://localhost/api/report/${token}`, {
    method: "POST",
    body:   form,
  })
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(0)
  return new File([content], name, { type })
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/report/[token] — file upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.qrCode.findUnique).mockResolvedValue(ACTIVE_QR as never)
    vi.mocked(prisma.qrCodeSubmission.create).mockResolvedValue({ id: "sub-1" } as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "admin-1" } as never)
    vi.mocked(prisma.issue.create).mockResolvedValue({ id: "issue-1" } as never)
  })

  it("accepts a JPEG photo (200)", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 1024)
    const req  = makeFormRequest("valid-token", file)
    const res  = await POST(req, makeParams("valid-token"))

    expect(res.status).toBe(200)
  })

  it("accepts a PNG photo (200)", async () => {
    const file = makeFile("photo.png", "image/png", 1024)
    const req  = makeFormRequest("valid-token", file)
    const res  = await POST(req, makeParams("valid-token"))

    expect(res.status).toBe(200)
  })

  it("rejects a non-image file type with 400", async () => {
    const file = makeFile("malware.exe", "application/octet-stream", 1024)
    const req  = makeFormRequest("valid-token", file)
    const res  = await POST(req, makeParams("valid-token"))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/image/i)
  })

  it("rejects a PDF disguised as JPEG with 400", async () => {
    const file = makeFile("not-a-photo.pdf", "application/pdf", 1024)
    const req  = makeFormRequest("valid-token", file)
    const res  = await POST(req, makeParams("valid-token"))

    expect(res.status).toBe(400)
  })

  it("rejects a file over 10 MB with 400", async () => {
    const TEN_MB_PLUS = 10 * 1024 * 1024 + 1
    const file = makeFile("huge.jpg", "image/jpeg", TEN_MB_PLUS)
    const req  = makeFormRequest("valid-token", file)
    const res  = await POST(req, makeParams("valid-token"))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/10 MB/i)
  })

  it("returns 404 for an inactive QR token", async () => {
    vi.mocked(prisma.qrCode.findUnique).mockResolvedValue({ ...ACTIVE_QR, isActive: false } as never)
    const file = makeFile("photo.jpg", "image/jpeg", 1024)
    const req  = makeFormRequest("inactive-token", file)
    const res  = await POST(req, makeParams("inactive-token"))

    expect(res.status).toBe(404)
  })

  it("returns 404 for a non-existent QR token", async () => {
    vi.mocked(prisma.qrCode.findUnique).mockResolvedValue(null)
    const file = makeFile("photo.jpg", "image/jpeg", 1024)
    const req  = makeFormRequest("bad-token", file)
    const res  = await POST(req, makeParams("bad-token"))

    expect(res.status).toBe(404)
  })
})
