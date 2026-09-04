import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Bot UA patterns — keep simple and fast
const BOT_RE = /bot|crawler|spider|scanner|preview|security|validator|archiver|bytespider|facebookexternal|whatsapp|slack|telegram|discord|python|ruby|curl|wget|java\/|go-http|axios|node-fetch|check|probe|monitor|pingdom|uptimerobot/i

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const fallback  = NextResponse.redirect("https://app.getrelay.software")
  if (!token) return fallback

  const lc = await prisma.linkClick.findUnique({ where: { token } })
  if (!lc) return fallback

  const ua    = req.headers.get("user-agent") ?? ""
  const isBot = BOT_RE.test(ua)

  const now = new Date()

  if (isBot) {
    // Mark as bot but still redirect — just don't count as real engagement
    await prisma.linkClick.update({
      where: { token },
      data: { isBotSuspected: true },
    }).catch(() => null)
  } else {
    // Timing heuristic: click within 5 s of send = likely a security scanner pre-fetch
    const tooFast = lc.emailSentAt
      ? (now.getTime() - lc.emailSentAt.getTime()) < 5_000
      : false

    await prisma.linkClick.update({
      where: { token },
      data: {
        clickCount:     { increment: 1 },
        firstClickedAt: lc.firstClickedAt ?? now,
        lastClickedAt:  now,
        isBotSuspected: lc.isBotSuspected || tooFast,
      },
    }).catch(() => null)
  }

  const response = NextResponse.redirect(lc.destinationUrl, { status: 302 })

  if (!isBot) {
    // Set first-party tracking cookie so downstream pages can attribute sessions
    response.cookies.set("relay_track", token, {
      maxAge:   30 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false, // must be readable by client-side tracker JS
      secure:   true,
      path:     "/",
    })
  }

  return response
}
