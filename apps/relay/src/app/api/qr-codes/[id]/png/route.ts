import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import QRCode from "qrcode"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qrCode = await prisma.qrCode.findUnique({
    where: { id },
    select: { organizationId: true, token: true, name: true },
  })

  if (!qrCode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (qrCode.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = `${APP_URL}/report/${qrCode.token}`
  const buffer = await QRCode.toBuffer(url, { width: 600, margin: 2 })

  const safeName = qrCode.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="relay-qr-${safeName}.png"`,
      "Cache-Control": "no-store",
    },
  })
}
