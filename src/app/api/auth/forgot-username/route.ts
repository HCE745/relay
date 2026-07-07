import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, forgotUsernameEmail } from "@/lib/email"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"

export async function POST(request: NextRequest) {
  const blocked = await checkLimit(
    limiters.forgotPw,
    `forgot-user:${getIP(request)}`,
    "Too many account lookup requests. Please try again in an hour.",
  )
  if (blocked) return blocked

  const { name, companyName } = await request.json() as { name?: string; companyName?: string }

  // Always return success to avoid leaking account existence
  if (!name?.trim() || !companyName?.trim()) return NextResponse.json({ ok: true })

  const user = await prisma.user.findFirst({
    where: {
      name:         { contains: name.trim(),        mode: "insensitive" },
      organization: { name: { contains: companyName.trim(), mode: "insensitive" } },
      isActive:     true,
    },
    select: { name: true, email: true, organization: { select: { name: true } } },
  })

  if (user) {
    sendEmail({
      to:      user.email,
      subject: "Your Relay login email",
      html:    forgotUsernameEmail({
        name:    user.name,
        email:   user.email,
        orgName: user.organization.name,
      }),
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
