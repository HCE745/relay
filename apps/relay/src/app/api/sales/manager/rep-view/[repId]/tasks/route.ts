import { NextResponse } from "next/server"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repId: string }> },
) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const tasks = await prisma.crmTask.findMany({
    where: { assignedToId: repId },
    select: {
      id: true,
      title: true,
      taskType: true,
      dueAt: true,
      completedAt: true,
      priority: true,
    },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
    take: 100,
  })

  return NextResponse.json(tasks)
}
