import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

const VERCEL_BASE = "https://api.vercel.com"

interface VercelDeploymentRaw {
  uid: string
  name: string
  url: string
  state: "READY" | "ERROR" | "BUILDING" | "CANCELED" | "QUEUED" | "INITIALIZING"
  createdAt: number
  buildingAt?: number
  ready?: number
  errorMessage?: string
  meta?: Record<string, string>
}

interface VercelDeploymentsResponse {
  deployments: VercelDeploymentRaw[]
}

async function vercelGet(path: string, params: Record<string, string> = {}): Promise<unknown | null> {
  const token     = process.env.VERCEL_TOKEN
  const teamId    = process.env.VERCEL_TEAM_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token) return null

  const url = new URL(`${VERCEL_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  if (teamId) url.searchParams.set("teamId", teamId)
  if (projectId && !url.searchParams.has("projectId")) url.searchParams.set("projectId", projectId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = process.env.VERCEL_TOKEN
  if (!token) {
    return NextResponse.json({ configured: false, deployments: [] })
  }

  const data = await vercelGet("/v6/deployments", { limit: "10", sort: "created" }) as VercelDeploymentsResponse | null

  if (!data) {
    return NextResponse.json({ configured: true, deployments: [], error: "Failed to fetch from Vercel API" })
  }

  const deployments = (data.deployments ?? []).map((d: VercelDeploymentRaw) => ({
    uid:          d.uid,
    name:         d.name,
    url:          d.url ? `https://${d.url}` : null,
    state:        d.state,
    createdAt:    d.createdAt,
    readyAt:      d.ready ?? null,
    errorMessage: d.errorMessage ?? null,
    commit:       d.meta?.githubCommitMessage ?? d.meta?.gitlabCommitMessage ?? null,
    branch:       d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? null,
    author:       d.meta?.githubCommitAuthorName ?? d.meta?.gitlabCommitAuthorName ?? null,
  }))

  return NextResponse.json({ configured: true, deployments })
}
