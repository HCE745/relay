import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { format, formatDistanceToNowStrict } from "date-fns"
import {
  AlertTriangle, CheckCircle, ExternalLink,
  Activity, Server, Building2, Clock,
} from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

const SENTRY_BASE = "https://sentry.io/api/0"
const VERCEL_BASE = "https://api.vercel.com"

// ── Sentry helpers ─────────────────────────────────────────────────────────────

interface SentryIssueRaw {
  id: string; title: string; culprit: string; shortId: string
  count: string; userCount: number; firstSeen: string; lastSeen: string
  isResolved: boolean; permalink: string; level: string
  tags?: Array<{ key: string; totalValues: number; topValues: Array<{ value: string; count: number }> }>
}
interface SentryTagValue { value: string; count: number; lastSeen: string }
interface VercelDeploymentRaw {
  uid: string; name: string; url: string; state: string
  createdAt: number; ready?: number; errorMessage?: string
  meta?: Record<string, string>
}

async function sentryGet(path: string, params: Record<string, string> = {}): Promise<unknown[] | null> {
  const token = process.env.SENTRY_AUTH_TOKEN
  const org   = process.env.SENTRY_ORG
  const proj  = process.env.SENTRY_PROJECT
  if (!token || !org || !proj) return null
  const url = new URL(`${SENTRY_BASE}/projects/${org}/${proj}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<unknown[]>
}

async function vercelGetDeployments(): Promise<VercelDeploymentRaw[]> {
  const token     = process.env.VERCEL_TOKEN
  const teamId    = process.env.VERCEL_TEAM_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token) return []
  const url = new URL(`${VERCEL_BASE}/v6/deployments`)
  url.searchParams.set("limit", "10")
  if (teamId)    url.searchParams.set("teamId", teamId)
  if (projectId) url.searchParams.set("projectId", projectId)
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!res.ok) return []
  const data = await res.json() as { deployments: VercelDeploymentRaw[] }
  return data.deployments ?? []
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  )
}

function LevelDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    fatal: "bg-red-500", error: "bg-orange-500", warning: "bg-amber-400",
    info: "bg-blue-400", debug: "bg-gray-600",
  }
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[level] ?? colors.error}`} />
}

function DeployState({ state }: { state: string }) {
  const styles: Record<string, string> = {
    READY: "bg-green-900/60 text-green-300",
    ERROR: "bg-red-900/60 text-red-400",
    BUILDING: "bg-blue-900/60 text-blue-300",
    CANCELED: "bg-gray-800 text-gray-500",
    QUEUED: "bg-gray-800 text-gray-400",
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[state] ?? styles.QUEUED}`}>
      {state}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PlatformHealthPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const sentryConfigured = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)
  const vercelConfigured = !!process.env.VERCEL_TOKEN

  // Parallel fetch: Sentry 24h, Sentry 7d, Sentry all-time recent, org tag breakdown, Vercel deployments
  const [issues24h, issues7d, topIssues, orgTagValues, deployments] = await Promise.all([
    sentryGet("issues/", { query: "is:unresolved", statsPeriod: "24h", limit: "100" }),
    sentryGet("issues/", { query: "is:unresolved", statsPeriod: "7d", limit: "100" }),
    sentryGet("issues/", { query: "is:unresolved", sort: "events", limit: "5" }),
    sentryGet("tags/organization_id/values/", { statsPeriod: "7d", limit: "20" }),
    vercelGetDeployments(),
  ])

  // Look up org names for the breakdown
  const orgIds = ((orgTagValues ?? []) as SentryTagValue[]).map((t) => t.value)
  const orgNames: Record<string, string> = {}
  if (orgIds.length > 0) {
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    })
    for (const o of orgs) orgNames[o.id] = o.name
  }

  const errors24h    = (issues24h ?? []).length
  const errors7d     = (issues7d  ?? []).length
  const top5         = ((topIssues ?? []) as SentryIssueRaw[]).slice(0, 5)
  const failedDeploys = deployments.filter((d) => d.state === "ERROR").length

  const healthColor =
    errors24h === 0  ? "text-green-400"
    : errors24h <= 5 ? "text-amber-400"
                     : "text-red-400"

  const orgBreakdown = ((orgTagValues ?? []) as SentryTagValue[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Platform Health</h1>
        </div>
        <p className="text-gray-400 text-sm">Real-time error monitoring across all organizations.</p>
      </div>

      {/* Not configured warning */}
      {!sentryConfigured && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Sentry not configured</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Set <code className="bg-amber-900/60 px-1 rounded">SENTRY_AUTH_TOKEN</code>,{" "}
              <code className="bg-amber-900/60 px-1 rounded">SENTRY_ORG</code>, and{" "}
              <code className="bg-amber-900/60 px-1 rounded">SENTRY_PROJECT</code> to enable error monitoring.
            </p>
          </div>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard value={errors24h}    label="Distinct issues (24 h)" color={healthColor} />
        <StatCard value={errors7d}     label="Distinct issues (7 d)"  color="text-white" />
        <StatCard value={failedDeploys} label="Failed deployments"     color={failedDeploys > 0 ? "text-red-400" : "text-green-400"} />
        <StatCard value={deployments.length > 0 ? 1 : 0} label={deployments[0]?.state === "READY" ? "Latest deploy: READY" : deployments[0]?.state ?? "No deployments"} color={deployments[0]?.state === "READY" ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Top 5 errors */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-white">Top 5 Errors (all time)</h2>
          </div>
          {!sentryConfigured ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-gray-500 text-sm">
              Configure Sentry to see error data.
            </div>
          ) : top5.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No active errors</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
              {top5.map((issue) => (
                <div key={issue.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <LevelDot level={issue.level ?? "error"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium leading-snug truncate">{issue.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-semibold text-gray-300">
                          {parseInt(issue.count, 10).toLocaleString()} events
                        </span>
                        <span>·</span>
                        <span>last {formatDistanceToNowStrict(new Date(issue.lastSeen), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-indigo-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orgs with most errors */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Most Errors by Org (7 d)</h2>
          </div>
          {!sentryConfigured ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-gray-500 text-sm">
              Configure Sentry to see per-org breakdown.
            </div>
          ) : orgBreakdown.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No org-tagged errors in last 7 days</p>
              <p className="text-gray-600 text-xs mt-1">
                Errors will appear here once tagged with organization_id
              </p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
              {orgBreakdown.map((row, i) => {
                const name = orgNames[row.value]
                const color =
                  row.count === 0  ? "text-green-400"
                  : row.count <= 5 ? "text-amber-400"
                                   : "text-red-400"
                return (
                  <div key={row.value} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      {name ? (
                        <Link
                          href={`/super-admin/organizations/${row.value}?tab=diagnostics`}
                          className="text-white text-xs font-medium hover:text-indigo-300 transition-colors"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="text-gray-500 text-xs font-mono">{row.value}</span>
                      )}
                      <p className="text-gray-600 text-[10px] mt-0.5">
                        last seen {formatDistanceToNowStrict(new Date(row.lastSeen), { addSuffix: true })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${color}`}>{row.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vercel deployments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Recent Vercel Deployments</h2>
        </div>
        {!vercelConfigured ? (
          <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium">Vercel not configured</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Set <code className="bg-amber-900/60 px-1 rounded">VERCEL_TOKEN</code> and optionally{" "}
                <code className="bg-amber-900/60 px-1 rounded">VERCEL_PROJECT_ID</code> to enable deployment tracking.
              </p>
            </div>
          </div>
        ) : deployments.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-gray-500 text-sm">
            No deployments found. Check VERCEL_TOKEN and VERCEL_PROJECT_ID.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
            {deployments.map((d, i) => (
              <div key={d.uid} className={`p-4 ${i === 0 ? "bg-gray-800/30" : ""}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <DeployState state={d.state} />
                    {i === 0 && <span className="text-[10px] text-gray-500 font-medium">latest</span>}
                    {d.meta?.githubCommitRef && (
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                        {d.meta.githubCommitRef}
                      </span>
                    )}
                    <div>
                      {d.meta?.githubCommitMessage && (
                        <p className="text-gray-300 text-xs max-w-sm truncate">{d.meta.githubCommitMessage}</p>
                      )}
                      {d.errorMessage && (
                        <p className="text-red-400 text-xs">{d.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {format(new Date(d.createdAt), "MMM d, HH:mm")}
                    </span>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-indigo-400 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
