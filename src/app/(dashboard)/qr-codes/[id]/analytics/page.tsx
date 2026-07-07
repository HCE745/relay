import { redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ArrowLeft, BarChart2, Clock, CheckCircle, XCircle, User, Mail, Phone } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function QrCodeAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const qrCode = await prisma.qrCode.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      department: { select: { name: true } },
    },
  })

  if (!qrCode || qrCode.organizationId !== session.organizationId) {
    redirect("/qr-codes")
  }

  const [submissions, allSubmissions] = await Promise.all([
    prisma.qrCodeSubmission.findMany({
      where: { qrCodeId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.qrCodeSubmission.findMany({
      where: { qrCodeId: id },
      select: { status: true },
    }),
  ])

  const total = allSubmissions.length
  const byStatus = {
    PENDING:   allSubmissions.filter(s => s.status === "PENDING").length,
    ROUTED:    allSubmissions.filter(s => s.status === "ROUTED").length,
    DISMISSED: allSubmissions.filter(s => s.status === "DISMISSED").length,
  }

  const statusConfig = {
    PENDING: {
      label: "Pending",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      badge: "bg-amber-100 text-amber-700",
    },
    ROUTED: {
      label: "Routed",
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
      badge: "bg-green-100 text-green-700",
    },
    DISMISSED: {
      label: "Dismissed",
      icon: XCircle,
      color: "text-gray-500",
      bg: "bg-gray-50 border-gray-200",
      badge: "bg-gray-100 text-gray-600",
    },
  }

  return (
    <div>
      <Header title="QR Code Analytics" />
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <Link
            href="/qr-codes"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to QR Codes
          </Link>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{qrCode.name}</h2>
          {qrCode.description && (
            <p className="text-sm text-gray-500 mt-1">{qrCode.description}</p>
          )}
          {(qrCode.location || qrCode.area) && (
            <p className="text-xs text-gray-400 mt-1">
              {[qrCode.location?.name, qrCode.area].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <BarChart2 className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total</div>
          </div>
          {(["PENDING", "ROUTED", "DISMISSED"] as const).map(status => {
            const cfg = statusConfig[status]
            const Icon = cfg.icon
            return (
              <div key={status} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${cfg.color}`} />
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{byStatus[status]}</div>
                <div className="text-xs text-gray-500 mt-0.5">{cfg.label}</div>
              </div>
            )
          })}
        </div>

        {/* Recent Submissions */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Submissions</h3>
            <p className="text-xs text-gray-400 mt-0.5">Last {submissions.length} of {total} total</p>
          </div>

          {submissions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <BarChart2 className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No submissions yet. Share the QR code to start collecting reports.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {submissions.map(sub => {
                const cfg = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.PENDING
                return (
                  <div key={sub.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{sub.title}</span>
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {sub.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{sub.description}</p>
                        )}
                        {(sub.reporterName || sub.reporterEmail || sub.reporterPhone) && (
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            {sub.reporterName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {sub.reporterName}
                              </span>
                            )}
                            {sub.reporterEmail && (
                              <a href={`mailto:${sub.reporterEmail}`} className="flex items-center gap-1 hover:text-blue-500">
                                <Mail className="w-3 h-3" /> {sub.reporterEmail}
                              </a>
                            )}
                            {sub.reporterPhone && (
                              <a href={`tel:${sub.reporterPhone}`} className="flex items-center gap-1 hover:text-blue-500">
                                <Phone className="w-3 h-3" /> {sub.reporterPhone}
                              </a>
                            )}
                          </div>
                        )}
                        {sub.photoUrls.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">{sub.photoUrls.length} photo{sub.photoUrls.length !== 1 ? "s" : ""} attached</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
