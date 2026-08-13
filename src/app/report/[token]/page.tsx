import { prisma } from "@/lib/prisma"
import { QrReportForm } from "./qr-report-form"

export const dynamic = "force-dynamic"

export default async function ReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const qrCode = await prisma.qrCode.findUnique({
    where: { token },
    include: {
      location: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, industry: true } },
    },
  })

  if (!qrCode || !qrCode.isActive) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Link No Longer Active</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            This reporting link is no longer active. Please contact the facility staff for assistance or look for an updated QR code.
          </p>
        </div>
      </div>
    )
  }

  const isCarWash = qrCode.organization.industry === "Car Wash"

  return (
    <QrReportForm
      isCarWash={isCarWash}
      qrCode={{
        id: qrCode.id,
        token: qrCode.token,
        name: qrCode.name,
        description: qrCode.description,
        reportingMode: qrCode.reportingMode,
        area: qrCode.area,
        defaultCategory: qrCode.defaultCategory,
        allowedCategories: qrCode.allowedCategories,
        collectContactInfo: qrCode.collectContactInfo,
        requireContactInfo: qrCode.requireContactInfo,
        requirePhoto: qrCode.requirePhoto,
        location: qrCode.location,
        department: qrCode.department,
        asset: qrCode.asset,
        organization: qrCode.organization,
      }}
    />
  )
}
