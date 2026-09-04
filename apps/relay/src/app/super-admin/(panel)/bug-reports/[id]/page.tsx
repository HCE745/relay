import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Bug } from "lucide-react"
import { BugReportActions } from "./bug-report-actions"

export const dynamic = "force-dynamic"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high:     "bg-orange-500 text-white",
  medium:   "bg-amber-500 text-white",
  low:      "bg-green-600 text-white",
}

const STATUS_COLOR: Record<string, string> = {
  new:           "bg-red-900/60 text-red-300 border-red-800",
  investigating: "bg-amber-900/60 text-amber-300 border-amber-800",
  fixed:         "bg-green-900/60 text-green-300 border-green-800",
  closed:        "bg-gray-800 text-gray-400 border-gray-700",
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-xs min-w-[120px] shrink-0">{label}</span>
      <span className="text-gray-200 text-xs">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default async function BugReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const { id } = await params
  const report = await prisma.bugReport.findUnique({ where: { id } })
  if (!report) notFound()

  const sentryErrors = report.sentryErrors as { id: string; title: string; count: string; lastSeen: string }[] | null

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/super-admin/bug-reports" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Bug Reports
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <Bug className="w-5 h-5 text-red-400" />
              <h1 className="text-xl font-bold text-white">{report.ticketNumber}</h1>
              {report.aiSeverity && (
                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${SEVERITY_COLOR[report.aiSeverity] ?? SEVERITY_COLOR.low}`}>
                  {report.aiSeverity}
                </span>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[report.status] ?? STATUS_COLOR.new}`}>
                {report.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {report.orgName} · {format(new Date(report.createdAt), "MMM d, yyyy h:mm a")}
            </p>
          </div>
          <BugReportActions reportId={report.id} currentStatus={report.status} adminNotes={report.adminNotes ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Bug Description">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{report.description}</p>
          </Section>

          <Section title="Expected Behavior">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{report.expectedBehavior}</p>
          </Section>

          {report.aiDiagnosis && (
            <div className="bg-blue-950/40 rounded-xl border border-blue-900/50 p-5 mb-4">
              <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-4">AI Diagnosis</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Likely Cause</p>
                  <p className="text-sm text-gray-200 leading-relaxed">{report.aiDiagnosis}</p>
                </div>
                {report.aiSuggestedFix && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Suggested Fix</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{report.aiSuggestedFix}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {sentryErrors && sentryErrors.length > 0 && (
            <Section title={`Matched Sentry Errors (${sentryErrors.length})`}>
              <div className="space-y-2">
                {sentryErrors.map((e, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-xs font-mono text-red-400 truncate">{e.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{e.count} occurrences · last seen {e.lastSeen}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!sentryErrors || sentryErrors.length === 0 ? (
            <Section title="Sentry Errors">
              <p className="text-xs text-gray-500">No matching Sentry errors found in the last 24 hours.</p>
            </Section>
          ) : null}

          {report.screenshotDataUrl && (
            <Section title="Screenshot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.screenshotDataUrl} alt="Bug screenshot" className="w-full rounded-lg border border-gray-700" />
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Customer Info">
            <div className="space-y-0.5">
              <InfoRow label="Name"         value={`${report.submittedByName} (${report.submittedByRole})`} />
              <InfoRow label="Organization" value={report.orgName} />
              <InfoRow label="Plan"         value={report.orgPlan ?? "—"} />
              <InfoRow label="Submitted"    value={format(new Date(report.createdAt), "MMM d, yyyy h:mm a")} />
            </div>
          </Section>

          <Section title="Auto-Captured Context">
            <div className="space-y-0.5">
              <InfoRow label="Page" value={
                <a href={report.currentPageUrl} target="_blank" rel="noreferrer"
                   className="text-blue-400 hover:underline break-all">
                  {report.currentPageUrl}
                </a>
              } />
              <InfoRow label="Browser" value={
                <span className="break-all">{report.browserInfo}</span>
              } />
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
