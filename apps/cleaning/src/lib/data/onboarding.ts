import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError } from "./errors"

// Employee onboarding packets (Phase 48). A packet is a reusable checklist;
// assigning it to a user snapshots each item's label into an OnboardingTask, so
// later packet edits never rewrite an in-flight or finished assignment — the
// SOP-acknowledgment immutability pattern (Phase 39). Completion is tracked per
// task; the assignment completes when every task is done.

export type PacketItemInput = { label: string; description?: string | null; requiresDocument?: boolean }
export type PacketInput = { name: string; description?: string | null; assignOnHire?: boolean; items: PacketItemInput[] }

export async function listPackets(orgId: string) {
  const packets = await orgDb(orgId).onboardingPacket.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true, assignments: true } } },
  })
  return packets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    assignOnHire: p.assignOnHire,
    isActive: p.isActive,
    itemCount: p._count.items,
    assignmentCount: p._count.assignments,
  }))
}

export async function getPacket(orgId: string, id: string) {
  const packet = await orgDb(orgId).onboardingPacket.findFirst({
    where: { id },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  })
  return packet
}

export async function createPacket(orgId: string, input: PacketInput) {
  return orgDb(orgId).onboardingPacket.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      description: input.description ?? null,
      assignOnHire: input.assignOnHire ?? false,
      items: {
        create: input.items.map((it, i) => ({
          organizationId: orgId,
          orderIndex: i,
          label: it.label.trim(),
          description: it.description ?? null,
          requiresDocument: it.requiresDocument ?? false,
        })),
      },
    },
    select: { id: true },
  })
}

export async function updatePacket(
  orgId: string,
  id: string,
  input: Partial<Pick<PacketInput, "name" | "description" | "assignOnHire">> & { isActive?: boolean; items?: PacketItemInput[] },
) {
  const packet = await orgDb(orgId).onboardingPacket.findFirst({ where: { id }, select: { id: true } })
  assertFound(packet, "Onboarding packet")
  const data: { name?: string; description?: string | null; assignOnHire?: boolean; isActive?: boolean } = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.description !== undefined) data.description = input.description
  if (input.assignOnHire !== undefined) data.assignOnHire = input.assignOnHire
  if (input.isActive !== undefined) data.isActive = input.isActive
  await orgDb(orgId).onboardingPacket.updateMany({ where: { id }, data })
  // Replacing the item list only affects FUTURE assignments (existing tasks are
  // snapshots and untouched).
  if (input.items !== undefined) {
    await orgDb(orgId).onboardingPacketItem.deleteMany({ where: { packetId: id } })
    if (input.items.length > 0) {
      await orgDb(orgId).onboardingPacketItem.createMany({
        data: input.items.map((it, i) => ({
          organizationId: orgId,
          packetId: id,
          orderIndex: i,
          label: it.label.trim(),
          description: it.description ?? null,
          requiresDocument: it.requiresDocument ?? false,
        })),
      })
    }
  }
  return orgDb(orgId).onboardingPacket.findFirst({ where: { id } })
}

/** Assign a packet to a user, snapshotting its items into tasks. */
export async function assignPacket(orgId: string, packetId: string, userId: string, assignedById: string | null) {
  const packet = await orgDb(orgId).onboardingPacket.findFirst({
    where: { id: packetId },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  })
  assertFound(packet, "Onboarding packet")
  const user = await orgDb(orgId).user.findFirst({ where: { id: userId }, select: { id: true } })
  assertFound(user, "Employee")
  // Don't double-assign the same packet while a prior assignment is open.
  const open = await orgDb(orgId).onboardingAssignment.findFirst({ where: { packetId, userId, completedAt: null }, select: { id: true } })
  if (open) throw new ForbiddenActionError("This packet is already assigned and in progress for this employee")

  const assignment = await orgDb(orgId).onboardingAssignment.create({
    data: {
      organizationId: orgId,
      packetId,
      userId,
      packetName: packet!.name,
      assignedById,
      tasks: {
        create: packet!.items.map((it) => ({
          organizationId: orgId,
          orderIndex: it.orderIndex,
          label: it.label,
          requiresDocument: it.requiresDocument,
        })),
      },
    },
    select: { id: true },
  })
  // A packet with no items is trivially complete.
  if (packet!.items.length === 0) {
    await orgDb(orgId).onboardingAssignment.updateMany({ where: { id: assignment.id }, data: { completedAt: new Date() } })
  }
  return assignment
}

/** Auto-assign every active assign-on-hire packet to a new employee. Best-effort. */
export async function assignOnHirePackets(orgId: string, userId: string, assignedById: string | null) {
  const packets = await orgDb(orgId).onboardingPacket.findMany({ where: { isActive: true, assignOnHire: true }, select: { id: true } })
  for (const p of packets) {
    try {
      await assignPacket(orgId, p.id, userId, assignedById)
    } catch {
      // A duplicate open assignment or other issue must never block the hire.
    }
  }
  return { assigned: packets.length }
}

export async function completeTask(
  orgId: string,
  taskId: string,
  completedById: string | null,
  input: { documentRef?: string | null; note?: string | null } = {},
) {
  const task = await orgDb(orgId).onboardingTask.findFirst({ where: { id: taskId }, select: { id: true, assignmentId: true, requiresDocument: true } })
  assertFound(task, "Onboarding task")
  if (task!.requiresDocument && !input.documentRef?.trim()) {
    throw new ForbiddenActionError("This task requires a document reference to complete")
  }
  await orgDb(orgId).onboardingTask.updateMany({
    where: { id: taskId },
    data: { status: "COMPLETE", completedById, completedAt: new Date(), documentRef: input.documentRef ?? null, note: input.note ?? null },
  })
  await maybeCompleteAssignment(orgId, task!.assignmentId)
  return { ok: true }
}

export async function reopenTask(orgId: string, taskId: string) {
  const task = await orgDb(orgId).onboardingTask.findFirst({ where: { id: taskId }, select: { id: true, assignmentId: true } })
  assertFound(task, "Onboarding task")
  await orgDb(orgId).onboardingTask.updateMany({ where: { id: taskId }, data: { status: "PENDING", completedById: null, completedAt: null } })
  // Reopening a task un-completes the assignment.
  await orgDb(orgId).onboardingAssignment.updateMany({ where: { id: task!.assignmentId }, data: { completedAt: null } })
  return { ok: true }
}

async function maybeCompleteAssignment(orgId: string, assignmentId: string) {
  const pending = await orgDb(orgId).onboardingTask.count({ where: { assignmentId, status: { not: "COMPLETE" } } })
  if (pending === 0) {
    await orgDb(orgId).onboardingAssignment.updateMany({ where: { id: assignmentId, completedAt: null }, data: { completedAt: new Date() } })
  }
}

export async function getAssignment(orgId: string, id: string) {
  return orgDb(orgId).onboardingAssignment.findFirst({
    where: { id },
    include: { tasks: { orderBy: { orderIndex: "asc" } }, user: { select: { name: true } } },
  })
}

/** All assignments with a completed/total progress count — the admin tracking view. */
export async function listAssignments(orgId: string) {
  const assignments = await orgDb(orgId).onboardingAssignment.findMany({
    orderBy: [{ completedAt: "asc" }, { assignedAt: "desc" }],
    include: { user: { select: { name: true } }, tasks: { select: { status: true } } },
  })
  return assignments.map((a) => {
    const total = a.tasks.length
    const done = a.tasks.filter((t) => t.status === "COMPLETE").length
    return {
      id: a.id,
      userName: a.user.name,
      packetName: a.packetName,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      total,
      done,
    }
  })
}
