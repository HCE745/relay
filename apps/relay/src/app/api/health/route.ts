import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status:    "ok",
      timestamp: new Date().toISOString(),
      database:  "ok",
    })
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString(), database: "error" },
      { status: 503 },
    )
  }
}
