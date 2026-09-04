import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> },
) {
  try {
    const { emailId } = await params
    const now = new Date()

    // Increment count and update last-opened timestamp
    await prisma.crmEmail.updateMany({
      where: { id: emailId },
      data:  { openCount: { increment: 1 }, lastOpenedAt: now },
    })

    // Set first-open timestamp only if not already recorded
    await prisma.crmEmail.updateMany({
      where: { id: emailId, openedAt: null },
      data:  { openedAt: now },
    })
  } catch {
    // Never fail — always return the pixel
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status:  200,
    headers: {
      "Content-Type":  "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma":        "no-cache",
      "Expires":       "0",
    },
  })
}
