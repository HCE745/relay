import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getPlatformConfig } from "@/lib/platform-config"
import { prisma } from "@/lib/prisma"
import {
  EMPTY_AGENT_STATE,
  buildBatchOpts,
  runResearchRound,
  updateAgentState,
  shouldRunNextRound,
  type JobCriteria,
  type AgentState,
} from "@/lib/research-agent"

export const maxDuration = 100

const ROUNDS_MAX = 5

// ── POST /api/super-admin/crm/prospects/discover/jobs ─────────────────────────
// Creates a research job, runs round 1 synchronously, saves results to a new
// research list, then marks the job pending for the cron to continue.
// Returns the job ID, list ID, round-1 results, and current status.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const discoveryEnabled = (await getPlatformConfig("ai_prospect_discovery_enabled")) !== "false"
    if (!discoveryEnabled) {
      return NextResponse.json(
        { error: "AI prospect discovery is disabled in CRM Settings", disabled: true, companies: [] },
        { status: 403 },
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const body = await req.json() as {
      country?:          string
      stateProvince?:    string
      industry?:         string
      employeeCountMin?: number
      employeeCountMax?: number
      keywords?:         string
      additionalContext?: string
      requestedCount?:   number
    }

    const criteria: JobCriteria = {
      country:           body.country           ?? "United States",
      stateProvince:     body.stateProvince      ?? undefined,
      industry:          body.industry           ?? "manufacturing",
      employeeCountMin:  body.employeeCountMin   ?? 50,
      employeeCountMax:  body.employeeCountMax   ?? 300,
      keywords:          body.keywords           ?? undefined,
      additionalContext: body.additionalContext  ?? undefined,
      requestedCount:    Math.min(body.requestedCount ?? 20, 20),
    }

    console.log("[jobs] creating research job:", JSON.stringify(criteria))

    // Auto-generate list name: "Manufacturing in Indiana — Nov 2026"
    const listLabel = [
      criteria.industry,
      "in",
      criteria.stateProvince ?? criteria.country,
      "—",
      new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    ].join(" ")

    // Create list + job in one transaction
    const { job, list } = await prisma.$transaction(async tx => {
      const list = await tx.prospectResearchList.create({
        data: {
          name:            listLabel,
          isShared:        false,
          salesUserId:     session.salesUserId  ?? null,
          superAdminId:    session.superAdminId ?? null,
          searchCountry:   criteria.country,
          searchState:     criteria.stateProvince ?? null,
          searchIndustry:  criteria.industry,
          searchEmpMin:    criteria.employeeCountMin,
          searchEmpMax:    criteria.employeeCountMax,
          searchKeywords:  criteria.keywords      ?? null,
          searchContext:   criteria.additionalContext ?? null,
        },
      })

      const job = await tx.prospectResearchJob.create({
        data: {
          listId:            list.id,
          salesUserId:       session.salesUserId  ?? null,
          superAdminId:      session.superAdminId ?? null,
          country:           criteria.country,
          stateProvince:     criteria.stateProvince ?? null,
          industry:          criteria.industry,
          employeeCountMin:  criteria.employeeCountMin,
          employeeCountMax:  criteria.employeeCountMax,
          keywords:          criteria.keywords      ?? null,
          additionalContext: criteria.additionalContext ?? null,
          requestedCount:    criteria.requestedCount,
          roundsMax:         ROUNDS_MAX,
          status:            "running",
          lockedAt:          new Date(),
          lockedUntil:       new Date(Date.now() + 120_000),
        },
      })

      return { job, list }
    })

    // Run round 1
    const batchOpts = await buildBatchOpts(criteria)

    let state: AgentState = EMPTY_AGENT_STATE
    let acceptedCount     = 0
    let inputTokensTotal  = 0
    let outputTokensTotal = 0
    let searchCallsTotal  = 0

    try {
      const round1 = await runResearchRound({
        apiKey,
        criteria,
        state,
        roundNum: 1,
        needed:   criteria.requestedCount,
        listId:   list.id,
        batchOpts,
        listSearchState: criteria.stateProvince ?? null,
      })

      state = updateAgentState(
        state,
        round1.allCandidates,
        round1.accepted,
        round1.crmFiltered,
        round1.geoFiltered,
        1,
        round1.subsectors,
        round1.sourceStrategy,
      )

      acceptedCount     += round1.accepted.length
      inputTokensTotal  += round1.inputTokens
      outputTokensTotal += round1.outputTokens
      searchCallsTotal  += round1.searchCalls

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[jobs] round 1 error:", msg)
      await prisma.prospectResearchJob.update({
        where: { id: job.id },
        data:  { status: "failed", lastError: msg, lockedUntil: null },
      })
      return NextResponse.json({
        error:   `Research failed during round 1: ${msg}`,
        jobId:   job.id,
        listId:  list.id,
        status:  "failed",
        companies: [],
      }, { status: 500 })
    }

    // Determine next status
    const continueJob = shouldRunNextRound(1, ROUNDS_MAX, acceptedCount, criteria.requestedCount, job.createdAt)

    await prisma.prospectResearchJob.update({
      where: { id: job.id },
      data: {
        status:           continueJob ? "pending" : "completed",
        roundsCompleted:  1,
        acceptedCount,
        agentState:       state as object,
        inputTokensTotal,
        outputTokensTotal,
        searchCallsTotal,
        lockedUntil:      null,
        lockedAt:         null,
      },
    })

    // Load the results we just saved to return them
    const listWithResults = await prisma.prospectResearchList.findUnique({
      where:   { id: list.id },
      include: { results: { orderBy: [{ fitScore: "desc" }, { companyName: "asc" }] } },
    })

    const companies = (listWithResults?.results ?? []).map(r => ({
      companyName:        r.companyName,
      website:            r.website            ?? "",
      city:               r.verifiedCity       ?? "",
      state:              r.verifiedState      ?? "",
      country:            r.verifiedCountry    ?? criteria.country,
      industry:           r.industry           ?? "",
      estimatedEmployees: r.estimatedEmployees ?? "",
      employeeCountTier:  (r.employeeCountSource ?? "unknown") as "web_confirmed" | "web_estimated" | "unknown",
      qualificationTier:  (r.locationVerified && r.employeeCountSource && r.employeeCountSource !== "unknown"
        ? "qualified" : r.locationVerified ? "potential" : "location_unverified") as "qualified" | "potential" | "location_unverified",
      sourceCitations:    r.sourceCitations    ?? [],
      locationVerified:   r.locationVerified,
      summary:            r.summary            ?? "",
      fitScore:           r.fitScore           ?? 50,
      crmStatus:          "none" as const,
    }))

    const qualifiedCount  = companies.filter(c => c.qualificationTier === "qualified").length
    const potentialCount  = companies.filter(c => c.qualificationTier === "potential").length
    const locationVerifiedCount = companies.filter(c => c.locationVerified).length

    const limitationNote = companies.length < criteria.requestedCount
      ? `Found ${companies.length} companies after round 1 (searching for up to ${criteria.requestedCount}). ` +
        (continueJob ? `Research is continuing in the background — more companies will appear shortly.` : ``)
      : undefined

    return NextResponse.json({
      jobId:                job.id,
      listId:               list.id,
      jobStatus:            continueJob ? "pending" : "completed",
      roundsCompleted:      1,
      roundsMax:            ROUNDS_MAX,
      companies,
      qualifiedCount,
      potentialCount,
      locationVerifiedCount,
      filteredCount:        0,
      rawCount:             companies.length,
      limitationNote,
    })

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err)
    console.error("[jobs] UNHANDLED ERROR:", msg)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}

// ── GET /api/super-admin/crm/prospects/discover/jobs ─────────────────────────
// Lists the caller's own research jobs (most recent first).
export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const jobs = await prisma.prospectResearchJob.findMany({
    where: session.superAdminId
      ? { superAdminId: session.superAdminId }
      : { salesUserId:  session.salesUserId },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:              true,
      status:          true,
      listId:          true,
      roundsCompleted: true,
      roundsMax:       true,
      acceptedCount:   true,
      requestedCount:  true,
      country:         true,
      stateProvince:   true,
      industry:        true,
      createdAt:       true,
      updatedAt:       true,
      lastError:       true,
    },
  })

  return NextResponse.json(jobs)
}
