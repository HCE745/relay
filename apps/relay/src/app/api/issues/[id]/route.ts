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
