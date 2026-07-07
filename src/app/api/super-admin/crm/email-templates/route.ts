import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.crmEmailTemplate.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, subject, body } = await req.json() as { name: string; subject: string; body: string }

  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "name, subject, and body required" }, { status: 400 })
  }

  const template = await prisma.crmEmailTemplate.create({
    data: {
      name:          name.trim(),
      subject:       subject.trim(),
      body:          body.trim(),
      isSystem:      false,
      createdBySAId: session.superAdminId ?? null,
    },
  })

  return NextResponse.json({ template })
}
