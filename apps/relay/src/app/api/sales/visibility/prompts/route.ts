import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prompts = await prisma.visibilityPrompt.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] })
  return NextResponse.json({ prompts })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { promptText?: string; category?: string }
  const { promptText, category } = body

  if (!promptText?.trim() || !category) {
    return NextResponse.json({ error: "promptText and category are required" }, { status: 400 })
  }

  const prompt = await prisma.visibilityPrompt.create({
    data: { promptText: promptText.trim(), category: category as never },
  })

  return NextResponse.json({ prompt })
}
