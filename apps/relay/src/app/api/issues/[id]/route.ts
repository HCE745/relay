import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { resolveIssuePattern } from "@/lib/patterns"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      reportedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      location: true,
      department: true,
      asset: true,
      vendor: true,
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      history: { orderBy: { createdAt: "desc" } },
      escalations: { orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(issue)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Role-based write authorization
  if (session.role === "EMPLOYEE" && !session.superAdmin) {
    // Employees may only update issues they personally submitted
    if (existing.reportedById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Employees may only set status to IN_PROGRESS — no other field changes
    const restricted = [
      "priority", "assignedToId", "locationId", "departmentId", "category",
      "vendorId", "assetId", "dueDate", "resolvedMethod", "resolutionCost",
      "rootCause", "timeToResolve", "resolutionCategory", "sopId",
      "sopComplianceOutcome", "title", "description",
    ]
    for (const field of restricted) {
      if (field in body) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (body.status !== undefined && body.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Cross-org entity validation for mutable FK fields
  const bodyLocationId   = body.locationId   || null
  const bodyDepartmentId = body.departmentId || null
  const bodyAssetId      = body.assetId      || null
  const bodyVendorId     = body.vendorId     || null

  if (bodyLocationId || bodyDepartmentId || bodyAssetId || bodyVendorId) {
    const [loc, dept, ast, vnd] = await Promise.all([
      bodyLocationId   ? prisma.location.findFirst({ where: { id: bodyLocationId,   organizationId: session.organizationId } })   : true,
      bodyDepartmentId ? prisma.department.findFirst({ where: { id: bodyDepartmentId, organizationId: session.organizationId } }) : true,
      bodyAssetId      ? prisma.asset.findFirst({ where: { id: bodyAssetId,         organizationId: session.organizationId } })   : true,
      bodyVendorId     ? prisma.vendor.findFirst({ where: { id: bodyVendorId,       organizationId: session.organizationId } })   : true,
    ])
    if (!loc || !dept || !ast || !vnd) {
      return NextResponse.json({ error: "Invalid entity reference" }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = {}
  const historyEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = []

  const tracked = ["status", "priority", "assignedToId", "locationId", "departmentId"] as const
  for (const field of tracked) {
    if (field in body && body[field] !== (existing as Record<string, unknown>)[field]) {
      historyEntries.push({
        field,
        oldValue: String((existing as Record<string, unknown>)[field] ?? ""),
        newValue: String(body[field] ?? ""),
      })
      updateData[field] = body[field]
    }
  }

  const simpleFields = ["title", "description", "category", "vendorId", "assetId", "dueDate"]
  for (const field of simpleFields) {
    if (field in body) updateData[field] = body[field] || null
  }

  const resolvingNow = body.status === "RESOLVED" && existing.status !== "RESOLVED"
  if (resolvingNow) {
    updateData.resolvedAt = new Date()
  }
  if (body.resolvedMethod !== undefined) {
    updateData.resolvedMethod = body.resolvedMethod || null
  }
  if (body.resolutionCost !== undefined) {
    updateData.resolutionCost = body.resolutionCost != null ? Number(body.resolutionCost) : null
  }
  if (body.rootCause !== undefined) updateData.rootCause = body.rootCause || null
  if (body.timeToResolve !== undefined) updateData.timeToResolve = body.timeToResolve || null
  if (body.resolutionCategory !== undefined) updateData.resolutionCategory = body.resolutionCategory || null

  // SOP compliance outcome — recorded during resolution
  if (body.sopComplianceOutcome !== undefined) {
    updateData.sopComplianceOutcome = body.sopComplianceOutcome || null
  }
  // Manual SOP link/unlink — admin/manager only
  if (body.sopId !== undefined) {
    if (!["ADMIN", "MANAGER"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    updateData.sopId = body.sopId || null
    updateData.sopLinkSource = body.sopId ? "MANUAL" : null
    if (!body.sopId) {
      updateData.sopMatchConfidence = null
      updateData.sopViolationNote = null
    }
  }

  const issue = await prisma.issue.update({
    where: { id },
    data: updateData,
    include: {
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  })

  if (historyEntries.length > 0) {
    await prisma.issueHistory.createMany({
      data: historyEntries.map((e) => ({
        issueId: id,
        changedById: session.userId,
        ...e,
      })),
    })
  }

  // Close open assignments when issue is resolved
  if (resolvingNow) {
    await prisma.assignment.updateMany({
      where: { linkedIssueId: id, completedAt: null },
      data:  { completedAt: new Date(), status: "completed" },
    })
  }

  // Update anonymized pattern when issue is resolved
  if (resolvingNow) {
    resolveIssuePattern(id, new Date(), existing.isEscalated, existing.createdAt)
      .catch(() => {/* non-critical */})
  }

  return NextResponse.json(issue)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const issue = await prisma.issue.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.issue.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
