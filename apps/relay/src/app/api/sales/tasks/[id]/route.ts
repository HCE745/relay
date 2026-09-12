export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  prospect: { select: { id: true, companyName: true } },
  demoCall: { select: { id: true, contactName: true, companyName: true } },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.crmTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (info.isRep && task.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, taskType, dueAt, notes, priority, completedAt, complete } = body;

  const updateData: Record<string, unknown> = {};

  if (title !== undefined) updateData.title = title;
  if (taskType !== undefined) updateData.taskType = taskType;
  if (dueAt !== undefined) updateData.dueAt = dueAt ? new Date(dueAt) : null;
  if (notes !== undefined) updateData.notes = notes;
  if (priority !== undefined) updateData.priority = priority;
  if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

  if (complete === true && !task.completedAt) {
    updateData.completedAt = new Date();
  } else if (complete === false) {
    updateData.completedAt = null;
  }

  const updated = await prisma.crmTask.update({
    where: { id },
    data: updateData,
    include: taskIncludes,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.crmTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (info.isRep && task.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.crmTask.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
