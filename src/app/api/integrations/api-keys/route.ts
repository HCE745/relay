import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { createHash, randomBytes } from "crypto"

function generateKey(): { raw: string; hash: string; prefix: string } {
  const raw = `rlk_${randomBytes(32).toString("hex")}`
  const hash = createHash("sha256").update(raw).digest("hex")
  const prefix = raw.slice(0, 12)
  return { raw, hash, prefix }
}

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, keyPrefix: true, isActive: true,
      lastUsedAt: true, expiresAt: true, createdAt: true,
    },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { api_webhooks_enabled: true },
  })
  if (!org?.api_webhooks_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as { name: string; expiresAt?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const { raw, hash, prefix } = generateKey()

  await prisma.apiKey.create({
    data: {
      organizationId: session.organizationId,
      name: body.name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      createdById: session.userId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  })

  return NextResponse.json({ key: raw, prefix })
}
