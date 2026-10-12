import { getPublicQrInfo, recordQrScan } from "@/lib/data/qr-codes"
import { QrReportForm } from "@/components/issues/qr-report-form"

export const dynamic = "force-dynamic"

export default async function PublicQrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const info = await getPublicQrInfo(token)
  // Count the scan (cheap counter) only for a live code.
  if (info?.isActive) await recordQrScan(token)

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      {!info || !info.isActive ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">This code isn&apos;t active. Please let the on-site staff know.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-center">
            <p className="text-sm text-slate-500">{info.organizationName}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Report a problem</h1>
            <p className="mt-1 text-sm text-slate-600">{info.siteName} · {info.label}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <QrReportForm token={token} />
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Your report goes straight to the cleaning team. No login needed.</p>
        </>
      )}
    </div>
  )
}
