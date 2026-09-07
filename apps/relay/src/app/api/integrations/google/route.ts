import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/connected-account-crypto"

export const dynamic = "force-dynamic"

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const account = await prisma.connectedAccount.findUnique({
    where: { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
  })

  if (!account) return NextResponse.json({ error: "No connected account" }, { status: 404 })

  // Revoke token on Google's side (fire-and-forget — don't fail disconnect if revocation fails)
  try {
    const refreshToken = decryptToken(account.refreshToken)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
    })
  } catch {
    // Revocation failure is non-fatal
  }

  await prisma.connectedAccount.delete({
    where: { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
  })

  return NextResponse.json({ ok: true })
}
