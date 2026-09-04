import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, trialExpiringEmail, trialExpiredEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

// Triggered by Vercel Cron (or any scheduler) once per day.
// Set CRON_SECRET in env and pass as Authorization: Bearer <secret>.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now   = new Date()
  const in7d  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in3d  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const upgradeUrl = `${appUrl}/settings/billing`

  let sent = 0

  // ── Trial expiring in 7 days ──────────────────────────────────────────────
  const expiring7 = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "trialing",
      isDemo: false,
      trialEndsAt: {
        gte: new Date(in7d.getTime() - 12 * 60 * 60 * 1000),
        lte: new Date(in7d.getTime() + 12 * 60 * 60 * 1000),
      },
    },
    include: {
      users:    { where: { role: "ADMIN", isActive: true }, select: { name: true, email: true }, take: 1 },
      _count:   { select: { issues: true, users: true, locations: true } },
    },
  })

  for (const org of expiring7) {
    const admin = org.users[0]
    if (!admin?.email) continue
    await sendEmail({
      to:      admin.email,
      subject: "Your Relay trial expires in 7 days",
      html:    trialExpiringEmail({
        name: admin.name, orgName: org.name, daysLeft: 7, upgradeUrl,
        usageStats: { issues: org._count.issues, users: org._count.users, locations: org._count.locations },
      }),
    })
    sent++
  }

  // ── Trial expiring in 3 days ──────────────────────────────────────────────
  const expiring3 = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "trialing",
      isDemo: false,
      trialEndsAt: {
        gte: new Date(in3d.getTime() - 12 * 60 * 60 * 1000),
        lte: new Date(in3d.getTime() + 12 * 60 * 60 * 1000),
      },
    },
    include: {
      users:  { where: { role: "ADMIN", isActive: true }, select: { name: true, email: true }, take: 1 },
      _count: { select: { issues: true, users: true, locations: true } },
    },
  })

  for (const org of expiring3) {
    const admin = org.users[0]
    if (!admin?.email) continue
    await sendEmail({
      to:      admin.email,
      subject: "Your Relay trial expires in 3 days",
      html:    trialExpiringEmail({
        name: admin.name, orgName: org.name, daysLeft: 3, upgradeUrl,
        usageStats: { issues: org._count.issues, users: org._count.users, locations: org._count.locations },
      }),
    })
    sent++
  }

  // ── Trial expired (ended in last 24 hours) ────────────────────────────────
  const expired = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "trialing",
      isDemo: false,
      trialEndsAt: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        lte: now,
      },
    },
    include: {
      users: { where: { role: "ADMIN", isActive: true }, select: { name: true, email: true }, take: 1 },
    },
  })

  for (const org of expired) {
    const admin = org.users[0]
    if (!admin?.email) continue

    await prisma.organization.update({
      where: { id: org.id },
      data:  { subscriptionStatus: "expired" },
    })

    await sendEmail({
      to:      admin.email,
      subject: "Your Relay trial has ended",
      html:    trialExpiredEmail({ name: admin.name, orgName: org.name, upgradeUrl }),
    })
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
