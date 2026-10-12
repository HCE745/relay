import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import QRCode from "qrcode"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getQrCode } from "@/lib/data/qr-codes"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

export default async function QrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) redirect("/dashboard")
  const { id } = await params
  const code = await getQrCode(session.organizationId, id)
  if (!code) notFound()

  const h = await headers()
  const baseUrl = process.env.CLEANING_APP_URL ?? `https://${h.get("host") ?? "your-app"}`
  const url = `${baseUrl}/r/${code!.token}`
  const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: "M" })

  return (
    <div className="mx-auto max-w-md px-6 py-10 text-center print:py-0">
      <div className="rounded-3xl border border-slate-200 p-8 print:border-0">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Report a problem</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{code!.serviceLocation.name}</h1>
        <p className="text-sm text-slate-500">{code!.label}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR code" className="mx-auto my-6 h-64 w-64" />
        <p className="text-base font-semibold text-slate-800">Scan with your phone camera</p>
        <p className="mt-1 break-all text-xs text-slate-400">{url}</p>
      </div>
      <p className="mt-4 text-xs text-slate-400 print:hidden">Use your browser&apos;s Print to post this. One code per location — revoke it any time without reprinting the others.</p>
    </div>
  )
}
