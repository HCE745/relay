export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// GET /api/sales/users — returns active sales reps (managers only)
export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.salesUser.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ users })
}
