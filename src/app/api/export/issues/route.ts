import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { format } from "date-fns"

function escape(v: unknown): string {
  const s = v == null ? "" : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = request.nextUrl
  const where: Record<string, unknown> = { organizationId: session.organizationId }
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const category = searchParams.get("category")
  const search = searchParams.get("search")
  if (status) where.status = status
  if (priority) where.priority = priority
  if (category) where.category = category
  if (search) where.title = { contains: search }

  const issues = await prisma.issue.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      reportedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      location:   { select: { name: true } },
      department: { select: { name: true } },
    },
  })

  const headers = ["ID", "Title", "Status", "Priority", "Category", "Reported By", "Assigned To", "Location", "Department", "Created", "Due Date"]
  const rows = issues.map(i => [
    i.id,
    i.title,
    ISSUE_STATUS[i.status as keyof typeof ISSUE_STATUS] ?? i.status,
    ISSUE_PRIORITY[i.priority as keyof typeof ISSUE_PRIORITY] ?? i.priority,
    ISSUE_CATEGORY[i.category as keyof typeof ISSUE_CATEGORY] ?? i.category,
    i.reportedBy.name,
    i.assignedTo?.name ?? "",
    i.location?.name ?? "",
    i.department?.name ?? "",
    format(new Date(i.createdAt), "yyyy-MM-dd HH:mm"),
    i.dueDate ? format(new Date(i.dueDate), "yyyy-MM-dd") : "",
  ])

  const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="issues-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  })
}
