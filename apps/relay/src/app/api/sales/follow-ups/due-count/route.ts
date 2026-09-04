import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ count: 0 }, { status: 401 })

  const count = await prisma.crmEmail.count({
    where: {
      followUpDate:   { lte: new Date() },
      followUpDoneAt: null,
      isDeleted:      false,
    },
  })

  return NextResponse.json({ count })
}
