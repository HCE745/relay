export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";
import { trackActivity } from "@/lib/sales-activity";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  prospect: { select: { id: true, companyName: true } },
  demoCall: { select: { id: true, contactName: true, companyName: true } },
  contact: { select: { id: true, name: true } },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const task = await prisma.crmTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (info.isRep && task.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, taskType, dueAt, notes, priority, completedAt, complete, outcome, completionNotes } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (taskType !== undefined) updateData.taskType = taskType;
    if (dueAt !== undefined) updateData.dueAt = dueAt ? new Date(dueAt) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

    const isNewCompletion = complete === true && !task.completedAt;
    if (isNewCompletion) {
      updateData.completedAt = new Date();
    } else if (complete === false) {
      updateData.completedAt = null;
    }

    const updated = await prisma.crmTask.update({
      where: { id },
      data: updateData,
      include: taskIncludes,
    });

    if (info.salesUserId && isNewCompletion) {
      trackActivity(info.salesUserId, "tasksCompleted");
      // Optionally log a sales activity when completing a task with an outcome
      if ((outcome || completionNotes) && task.prospectId) {
        await prisma.salesCrmActivity.create({
          data: {
            prospectId:  task.prospectId,
            contactId:   task.contactId ?? null,
            salesUserId: info.salesUserId,
            activityType: "TASK_COMPLETED",
            subject:     task.title,
            outcome:     outcome ?? null,
            notes:       completionNotes ?? null,
          },
        }).catch(() => { /* non-fatal */ });
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const task = await prisma.crmTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (info.isRep && task.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.crmTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
