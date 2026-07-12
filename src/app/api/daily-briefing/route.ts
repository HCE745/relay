import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getOrgWCFlags } from "@/lib/workforce-comms"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date().toISOString().split("T")[0]

  // Check cache first
  const cached = await prisma.dailyBriefingCache.findUnique({
    where: { userId_date: { userId: session.userId, date: today } },
  })
  if (cached) return NextResponse.json({ briefing: cached.content, cached: true })

  const wcFlags = await getOrgWCFlags(session.organizationId)
  const aiEnabled = wcFlags?.wc_ai_daily_briefing ?? false

  // Gather context
  const [myAssignments, myIssues, announcements] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        orgId:      session.organizationId,
        assigneeId: session.userId,
        status:     { in: ["pending", "acknowledged", "in_progress"] },
      },
      include: { linkedIssue: { select: { title: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 10,
    }),
    prisma.issue.findMany({
      where: {
        organizationId: session.organizationId,
        assignedToId:   session.userId,
        status:         { notIn: ["closed", "resolved"] },
      },
      select: { title: true, priority: true, status: true, dueDate: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.announcement.findMany({
      where: {
        orgId: session.organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { title: true, priority: true, body: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ])

  const overdueAssignments = myAssignments.filter(
    a => a.dueDate && new Date(a.dueDate) < new Date()
  )

  const prompt = `You are a helpful work assistant. Generate a concise daily briefing for ${session.name} (${session.role}) for today, ${today}.

Context:
- My open assignments (${myAssignments.length}): ${myAssignments.map(a => `"${a.title}" (${a.priority}, ${a.status}${a.dueDate ? `, due ${new Date(a.dueDate).toLocaleDateString()}` : ""})`).join("; ") || "none"}
- Overdue assignments: ${overdueAssignments.length > 0 ? overdueAssignments.map(a => `"${a.title}"`).join(", ") : "none"}
- My open issues (${myIssues.length}): ${myIssues.map(i => `"${i.title}" (${i.priority})`).join("; ") || "none"}
- Recent announcements: ${announcements.map(a => `[${a.priority}] ${a.title}`).join("; ") || "none"}

Write a brief, actionable daily briefing in 3-5 sentences. Lead with the most urgent item. Mention overdue items if any. End with a single motivational sentence. Use plain prose, no bullet points, no markdown.`

  let content = ""
  if (!aiEnabled) {
    const todayDate = new Date(today)
    const dueToday = myAssignments.filter(a => a.dueDate && new Date(a.dueDate).toISOString().split("T")[0] === today)
    const lines: string[] = [`Daily Briefing — ${today}`]
    lines.push("")
    lines.push(`Assignments (${myAssignments.length} open${overdueAssignments.length > 0 ? `, ${overdueAssignments.length} overdue` : ""}):`)
    if (myAssignments.length === 0) {
      lines.push("  No open assignments.")
    } else {
      myAssignments.slice(0, 10).forEach(a => {
        const due = a.dueDate ? ` — due ${new Date(a.dueDate).toLocaleDateString()}` : ""
        const overdue = a.dueDate && new Date(a.dueDate) < new Date() ? " ⚠ overdue" : ""
        lines.push(`  • [${a.priority}] ${a.title}${due}${overdue}`)
      })
    }
    lines.push("")
    lines.push(`Issues (${myIssues.length} open):`)
    if (myIssues.length === 0) {
      lines.push("  No open issues.")
    } else {
      myIssues.forEach(i => {
        const due = i.dueDate ? ` — due ${new Date(i.dueDate).toLocaleDateString()}` : ""
        lines.push(`  • [${i.priority}] ${i.title}${due}`)
      })
    }
    if (announcements.length > 0) {
      lines.push("")
      lines.push("Recent Announcements:")
      announcements.forEach(a => lines.push(`  • [${a.priority}] ${a.title}`))
    }
    content = lines.join("\n")
    void todayDate
  } else {
    try {
      const client = new Anthropic()
      const msg = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages:   [{ role: "user", content: prompt }],
      })
      content = (msg.content[0] as { type: string; text: string }).text
    } catch {
      content = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${session.name}! You have ${myAssignments.length} open assignment${myAssignments.length !== 1 ? "s" : ""}${overdueAssignments.length > 0 ? ` (${overdueAssignments.length} overdue)` : ""}. Focus on your highest-priority items first and have a productive day.`
    }
  }

  // Cache it
  await prisma.dailyBriefingCache.upsert({
    where:  { userId_date: { userId: session.userId, date: today } },
    create: { userId: session.userId, date: today, content },
    update: { content },
  })

  return NextResponse.json({ briefing: content, cached: false })
}
