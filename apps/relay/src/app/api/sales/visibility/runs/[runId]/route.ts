import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params

  const [run, checks, prompts] = await Promise.all([
    prisma.visibilityRun.findUnique({ where: { runId } }),
    prisma.visibilityCheck.findMany({ where: { runId }, orderBy: { createdAt: "asc" } }),
    prisma.visibilityPrompt.findMany(),
  ])

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]))
  const enrichedChecks = checks.map(c => ({
    ...c,
    prompt: promptMap[c.promptId] ?? null,
  }))

  return NextResponse.json({ run, checks: enrichedChecks })
}
