/**
 * Multi-tenant isolation tests.
 * Verifies that Org A's users cannot access Org B's resources.
 * Uses a mock Prisma client scoped to realistic query patterns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession:    vi.fn(),
  createSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    issue: {
      findFirst: vi.fn(),
      findMany:  vi.fn().mockResolvedValue([]),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    suggestion:   { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock("@/lib/ratelimit",        () => ({ checkLimit: vi.fn().mockResolvedValue(null), limiters: { issues: "i", suggestions: "s" }, getIP: vi.fn().mockReturnValue("127.0.0.1") }))
vi.mock("@/lib/routing",          () => ({ autoRouteIssue: vi.fn().mockResolvedValue({ userId: null }) }))
vi.mock("@/lib/patterns",         () => ({ writeIssuePattern: vi.fn() }))
vi.mock("@/lib/ai-suggestions",   () => ({ generateIssueSuggestions: vi.fn() }))
vi.mock("@/lib/sop-matching",     () => ({ matchSOPToIssue: vi.fn() }))
vi.mock("@/lib/injury-notifications", () => ({ dispatchInjuryNotifications: vi.fn() }))
vi.mock("@/lib/notification-rules",   () => ({ dispatchNotificationRules: vi.fn(), parseNotificationRules: vi.fn() }))
vi.mock("@/lib/priority-rules",       () => ({ applyPriorityRules: vi.fn(), parsePriorityRules: vi.fn() }))
vi.mock("@/lib/push-notifications",   () => ({ sendPushNotification: vi.fn() }))
vi.mock("@/lib/ai-haiku",             () => ({ checkDuplicateIssue: vi.fn().mockResolvedValue(null), suggestIssueTitle: vi.fn() }))
vi.mock("@/lib/analytics",            () => ({ logActivationEvent: vi.fn() }))
vi.mock("@/lib/resolve-issue-pattern",() => ({ resolveIssuePattern: vi.fn() }))
vi.mock("@/lib/subscription-guard",   () => ({ requireActiveSubscription: vi.fn().mockResolvedValue(null) }))

import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { GET as getIssue } from "@/app/api/issues/[id]/route"

// ── Session factories ─────────────────────────────────────────────────────────

function sessionForOrg(orgId: string, userId = "user-1") {
  return { userId, organizationId: orgId, email: "u@example.com", name: "User", role: "ADMIN" }
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/issues/[id] — cross-org IDOR", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns the issue when it belongs to the user's org", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionForOrg("org-A") as never)
    vi.mocked(prisma.issue.findFirst).mockResolvedValue({
      id: "issue-1",
      organizationId: "org-A",
      title: "Broken machine",
      reportedBy: { id: "user-1", name: "User", email: "u@example.com" },
      assignedTo: null,
      location: null,
      department: null,
      asset: null,
      vendor: null,
      comments: [],
      history: [],
      escalations: [],
      attachments: [],
    })

    const req = new NextRequest("http://localhost/api/issues/issue-1")
    const res = await getIssue(req, makeParams("issue-1"))

    expect(res.status).toBe(200)
    // The prisma findFirst should have been called with organizationId: "org-A"
    expect(prisma.issue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "issue-1", organizationId: "org-A" }),
      })
    )
  })

  it("returns 404 when the issue belongs to a different org", async () => {
    // Org B's user tries to fetch Org A's issue
    vi.mocked(getSession).mockResolvedValue(sessionForOrg("org-B") as never)
    // Prisma returns null because the WHERE clause includes org-B, not org-A
    vi.mocked(prisma.issue.findFirst).mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/issues/issue-1")
    const res = await getIssue(req, makeParams("issue-1"))

    expect(res.status).toBe(404)
    // The query must include the session's organizationId to prevent IDOR
    expect(prisma.issue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-B" }),
      })
    )
  })
})
