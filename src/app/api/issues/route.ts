import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { autoRouteIssue } from "@/lib/routing"
import { writeIssuePattern } from "@/lib/patterns"
import { generateIssueSuggestions } from "@/lib/ai-suggestions"
import { matchSOPToIssue } from "@/lib/sop-matching"
import { checkLimit, limiters } from "@/lib/ratelimit"
import { dispatchInjuryNotifications } from "@/lib/injury-notifications"
import { sendPushNotification } from "@/lib/push-notifications"

// ── AI category + priority inference ──────────────────────────────────────────

const VALID_CATEGORIES = [
  "INJURY", "EQUIPMENT_BREAKDOWN", "MAINTENANCE", "SAFETY", "SUPPLY_SHORTAGE",
  "CUSTOMER_COMPLAINT", "FACILITY", "VEHICLE", "EMPLOYEE", "GENERAL",
] as const

const VALID_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const

async function inferCategoryAndPriority(
  title: string,
  description: string,
): Promise<{ category: string; priority: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `Classify this workplace issue report. Respond ONLY with a valid JSON object — no markdown, no explanation.

Title: ${JSON.stringify(title)}
Description: ${JSON.stringify(description?.slice(0, 500) || "")}

Categories (pick the single best key):
INJURY – a person was hurt or injured
EQUIPMENT_BREAKDOWN – machine, tool, or equipment failed or is broken
MAINTENANCE – scheduled maintenance, general wear, routine repair
SAFETY – hazard or unsafe condition (not an active injury)
SUPPLY_SHORTAGE – missing or out-of-stock supplies or materials
CUSTOMER_COMPLAINT – customer dissatisfaction or complaint
FACILITY – building, infrastructure, electrical, plumbing, utilities
VEHICLE – company vehicle problem
EMPLOYEE – HR, people, or personnel matter
GENERAL – doesn't clearly fit any category above

Priority (pick one):
CRITICAL – immediate safety risk, operations fully halted, or emergency
HIGH – significant operational impact, needs same-day attention
MEDIUM – noticeable issue, should be addressed this week
LOW – minor or cosmetic, no operational urgency

Respond with exactly: {"category":"CATEGORY_KEY","priority":"PRIORITY_KEY"}`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim()
    if (!text) return null

    const match = text.match(/\{[^}]+\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as { category?: string; priority?: string }

    const cat = parsed.category?.toUpperCase()
    const pri = parsed.priority?.toUpperCase()

    return {
      category: (VALID_CATEGORIES as readonly string[]).includes(cat ?? "") ? cat! : "GENERAL",
      priority: (VALID_PRIORITIES as readonly string[]).includes(pri ?? "") ? pri! : "MEDIUM",
    }
  } catch (err) {
    console.warn("[Issue inference] AI category/priority inference failed:", err)
    return null
  }
}

// ── GET /api/issues ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const category = searchParams.get("category")
  const locationId = searchParams.get("locationId")
  const assignedToId = searchParams.get("assignedToId")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = { organizationId: session.organizationId }
  if (status) where.status = status
  if (priority) where.priority = priority
  if (category) where.category = category
  if (locationId) where.locationId = locationId
  if (assignedToId) where.assignedToId = assignedToId
  if (search) where.title = { contains: search }

  const issues = await prisma.issue.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json(issues)
}

// ── POST /api/issues ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const blocked = await checkLimit(
    limiters.issues,
    `issues:${session.userId}`,
    "Issue submission limit reached. You can submit up to 50 issues per hour.",
  )
  if (blocked) return blocked

  const body = await request.json()
  const {
    title, description, priority, category,
    locationId, departmentId, assetId, vendorId,
    assignedToId: manualAssignee, dueDate,
    attachments, sopViolation, sopId,
    injurySeverity, injuryDescription, areaDetail,
  } = body

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

  // ── 1. Fetch reporter profile (location/department/manager fallbacks) ────────
  const reporter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      locationId:   true,
      departmentId: true,
      managerId:    true,
      manager:      { select: { id: true, name: true } },
    },
  })

  // ── 2. Location + department fallback from user profile ─────────────────────
  // User-submitted value → user's primary location/department → null
  const resolvedLocationId: string | null   = locationId   || reporter?.locationId   || null
  const resolvedDepartmentId: string | null = departmentId || reporter?.departmentId || null

  // ── 3. AI category + priority inference (synchronous, graceful fallback) ────
  // Only runs for fields the user left on Automatic (null/empty).
  // If the Anthropic call fails or times out, falls back to GENERAL/MEDIUM.
  let resolvedCategory: string = category || ""
  let resolvedPriority: string = priority || ""

  const needsInference = !resolvedCategory || !resolvedPriority
  if (needsInference) {
    const inferred = await inferCategoryAndPriority(title, description ?? "")
    if (!resolvedCategory) resolvedCategory = inferred?.category ?? "GENERAL"
    if (!resolvedPriority) resolvedPriority = inferred?.priority ?? "MEDIUM"
  }

  if (!resolvedCategory) resolvedCategory = "GENERAL"
  if (!resolvedPriority) resolvedPriority = "MEDIUM"

  // ── 4. Auto-routing (runs after all inference + fallbacks are applied) ───────
  let resolvedAssigneeId: string | null = manualAssignee || null
  let autoRoutedTo: string | null = null
  let routingRuleName: string | null = null

  if (!resolvedAssigneeId) {
    // Injury reports: primary assignee is the reporter's supervisor
    if (resolvedCategory === "INJURY") {
      if (reporter?.managerId && reporter.manager) {
        resolvedAssigneeId = reporter.managerId
        autoRoutedTo      = reporter.manager.name
        routingRuleName   = "Injury — supervisor"
      }
    }

    // Standard routing — runs with AI-inferred category, resolved location + department
    if (!resolvedAssigneeId) {
      const routing = await autoRouteIssue({
        organizationId: session.organizationId,
        category:       resolvedCategory,
        priority:       resolvedPriority,
        locationId:     resolvedLocationId,
        departmentId:   resolvedDepartmentId,
        assetId:        assetId || null,
      })
      resolvedAssigneeId = routing.userId
      autoRoutedTo       = routing.userName
      routingRuleName    = routing.ruleName
    }
  }

  // ── Fetch org + asset type + location/department for patterns and suggestions
  const [org, asset, location, department] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { industry: true, aiSuggestionsAvailable: true, aiSuggestionsPolicy: true, aiSuggestionsAudience: true },
    }),
    assetId           ? prisma.asset.findUnique({ where: { id: assetId }, select: { type: true } }) : null,
    resolvedLocationId   ? prisma.location.findUnique({ where: { id: resolvedLocationId }, select: { name: true } }) : null,
    resolvedDepartmentId ? prisma.department.findUnique({ where: { id: resolvedDepartmentId }, select: { name: true } }) : null,
  ])

  const issue = await prisma.issue.create({
    data: {
      title,
      description,
      priority:       resolvedPriority,
      category:       resolvedCategory,
      status:         "OPEN",
      organizationId: session.organizationId,
      reportedById:   session.userId,
      locationId:     resolvedLocationId,
      departmentId:   resolvedDepartmentId,
      assetId:        assetId   || null,
      vendorId:       vendorId  || null,
      assignedToId:   resolvedAssigneeId,
      dueDate:        dueDate ? new Date(dueDate) : null,
      sopViolation:   sopViolation === true,
      sopId:          sopId || null,
      injurySeverity:    resolvedCategory === "INJURY" ? (injurySeverity    || null) : null,
      injuryDescription: resolvedCategory === "INJURY" ? (injuryDescription || null) : null,
      areaDetail:        areaDetail || null,
    },
    include: {
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      location:   { select: { id: true, name: true } },
    },
  })

  // ── Attachments ────────────────────────────────────────────────────────────
  const attachmentList = Array.isArray(attachments) ? attachments : []
  if (attachmentList.length > 0) {
    await prisma.attachment.createMany({
      data: attachmentList.map((a: { url: string; filename: string; mimeType: string; size: number }) => ({
        url:      a.url,
        filename: a.filename,
        mimeType: a.mimeType,
        size:     a.size,
        issueId:  issue.id,
      })),
    })
  }

  // ── Injury notifications (channel-agnostic dispatch) ─────────────────────
  if (resolvedCategory === "INJURY" && injurySeverity) {
    await dispatchInjuryNotifications({
      organizationId: session.organizationId,
      issueId:        issue.id,
      reporterName:   issue.reportedBy.name,
      severity:       injurySeverity as "MINOR" | "MODERATE" | "SEVERE",
      injuryDescription: injuryDescription ?? "(no description provided)",
      locationId:    resolvedLocationId,
      locationName:  issue.location?.name ?? null,
      supervisorId:  reporter?.managerId ?? resolvedAssigneeId,
      excludeUserId: session.userId,
    })
  }

  // ── AI suggestions (fire-and-forget) ──────────────────────────────────────
  const aiPolicy = org?.aiSuggestionsPolicy ?? "user_choice"
  if (!org?.aiSuggestionsAvailable) {
    // Feature not enabled for this org — skip
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[AI Suggestion] ANTHROPIC_API_KEY not set — skipping for issue", issue.id)
  } else if (aiPolicy === "off_all") {
    console.log("[AI Suggestion] Org policy is off_all — skipping for issue", issue.id)
  } else {
    // Guard AI calls with a per-org hourly cap to prevent runaway Anthropic costs
    const aiBlocked = await checkLimit(limiters.aiOrg, `ai-org:${session.organizationId}`)
    if (aiBlocked) {
      console.warn("[AI Suggestion] Org AI rate limit reached for org", session.organizationId)
    } else {
    generateIssueSuggestions(
      {
        id:             issue.id,
        title,
        description:    description ?? null,
        category:       resolvedCategory,
        priority:       resolvedPriority,
        organizationId: session.organizationId,
        assetType:      asset?.type ?? null,
        locationName:   location?.name ?? null,
        departmentName: department?.name ?? null,
      },
      org?.industry ?? null
    ).then(({ submitterSuggestion, assigneeSuggestion }) => {
      if (submitterSuggestion || assigneeSuggestion) {
        return prisma.issue.update({
          where: { id: issue.id },
          data: {
            ...(submitterSuggestion ? { submitterSuggestion } : {}),
            ...(assigneeSuggestion  ? { assigneeSuggestion  } : {}),
          },
        })
      }
    }).catch((err) => {
      console.error("[AI Suggestion] Background generation failed for issue", issue.id, err)
    })
    } // end aiBlocked else
  }

  // ── SOP matching (fire-and-forget — only when no manual SOP selected) ─────
  if (!sopId && process.env.ANTHROPIC_API_KEY) {
    matchSOPToIssue({
      id:             issue.id,
      title,
      description:    description ?? null,
      category:       resolvedCategory,
      assetType:      asset?.type ?? null,
      departmentId:   resolvedDepartmentId ?? null,
      organizationId: session.organizationId,
    }).then(match => {
      if (!match) return
      return prisma.issue.update({
        where: { id: issue.id },
        data: {
          sopId:             match.sopId,
          sopMatchConfidence: match.confidence,
          sopViolationNote:  match.violationNote,
        },
      })
    }).catch(() => {/* non-critical */})
  }

  // ── Pattern record (fire-and-forget) ──────────────────────────────────────
  writeIssuePattern({
    issueId:     issue.id,
    category:    resolvedCategory,
    priority:    resolvedPriority,
    orgIndustry: org?.industry,
    assetType:   asset?.type ?? null,
    recordType:  "issue",
  }).catch(() => {/* non-critical */})

  // ── History + assignee notification ───────────────────────────────────────
  await prisma.issueHistory.create({
    data: {
      issueId:     issue.id,
      field:       "status",
      oldValue:    null,
      newValue:    "OPEN",
      changedById: session.userId,
    },
  })

  if (resolvedAssigneeId) {
    await Promise.all([
      prisma.issueHistory.create({
        data: {
          issueId:     issue.id,
          field:       "assignedToId",
          oldValue:    null,
          newValue:    resolvedAssigneeId,
          changedById: session.userId,
        },
      }),
      prisma.notification.create({
        data: {
          userId:         resolvedAssigneeId,
          organizationId: session.organizationId,
          issueId:        issue.id,
          type:           "ISSUE_ASSIGNED",
          title:          "New Issue Assigned",
          message:        routingRuleName
            ? `Auto-routed to you via rule "${routingRuleName}": ${title}`
            : `You've been assigned issue: ${title}`,
        },
      }),
    ])
    // Fire push alongside in-app notification (non-blocking)
    void sendPushNotification(
      resolvedAssigneeId,
      "New Issue Assigned",
      routingRuleName
        ? `Auto-routed via "${routingRuleName}": ${title}`
        : `You've been assigned: ${title}`,
      { url: `/issues/${issue.id}`, issueId: issue.id },
    )
  }

  return NextResponse.json(
    { ...issue, autoRoutedTo, routingRuleName },
    { status: 201 }
  )
}
