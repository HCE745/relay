import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks (must precede the route import) ─────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

// Capture the create mock before vi.mock hoisting runs the factory
const mockCreate = vi.fn()
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}))

import { getSession } from "@/lib/session"
import { POST } from "@/app/api/super-admin/crm/prospects/discover/verify/route"

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = "test_key"
})

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("https://app.test/api/discover/verify", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

function mockResponse(text: string) {
  mockCreate.mockResolvedValue({
    content:    [{ type: "text", text }],
    usage:      { input_tokens: 50, output_tokens: 30 },
    stop_reason: "end_turn",
  })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("verify route — auth", () => {
  it("returns 403 when no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(makeReq({ companyName: "Acme Mfg", locationVerified: true }))
    expect(res.status).toBe(403)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe("verify route — input validation", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ superAdmin: true } as never)
  })

  it("returns 400 for missing companyName", async () => {
    const res = await POST(makeReq({ website: "https://example.com" }))
    expect(res.status).toBe(400)
  })

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await POST(makeReq({ companyName: "Acme Mfg" }))
    expect(res.status).toBe(500)
  })
})

// ─── Success paths ────────────────────────────────────────────────────────────

describe("verify route — success", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ superAdmin: true } as never)
  })

  it("returns web_confirmed tier from LinkedIn result", async () => {
    mockResponse(JSON.stringify({
      employeeCountTier:  "web_confirmed",
      estimatedEmployees: "80-150",
      sourceCitations:    [],
    }))

    const res  = await POST(makeReq({
      companyName:     "Acme Mfg",
      website:         "https://acmemfg.com",
      empMin:          50,
      empMax:          300,
      locationVerified: true,
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { employeeCountTier: string; qualificationTier: string; estimatedEmployees: string }
    expect(body.employeeCountTier).toBe("web_confirmed")
    expect(body.qualificationTier).toBe("qualified")
    expect(body.estimatedEmployees).toBe("80-150")
  })

  it("returns potential tier when no headcount evidence found", async () => {
    mockResponse(JSON.stringify({
      employeeCountTier:  "unknown",
      estimatedEmployees: "unknown",
      sourceCitations:    [],
    }))

    const res  = await POST(makeReq({
      companyName:      "Small Mfg Co",
      locationVerified: true,
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { employeeCountTier: string; qualificationTier: string }
    expect(body.employeeCountTier).toBe("unknown")
    expect(body.qualificationTier).toBe("potential")
  })

  it("returns location_unverified when locationVerified is false", async () => {
    mockResponse(JSON.stringify({
      employeeCountTier:  "web_estimated",
      estimatedEmployees: "200-400",
      sourceCitations:    [],
    }))

    const res  = await POST(makeReq({
      companyName:      "Big Corp",
      locationVerified: false,
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { qualificationTier: string }
    // Even with size evidence, location_unverified if locationVerified is false
    expect(body.qualificationTier).toBe("location_unverified")
  })

  it("handles malformed JSON from AI gracefully", async () => {
    mockResponse("not valid json at all")

    const res  = await POST(makeReq({
      companyName:      "Acme Mfg",
      locationVerified: true,
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { employeeCountTier: string; qualificationTier: string }
    // Falls back to unknown/potential
    expect(body.employeeCountTier).toBe("unknown")
    expect(body.qualificationTier).toBe("potential")
  })
})
