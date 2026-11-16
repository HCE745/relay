import "server-only"
import { NextRequest, NextResponse, after } from "next/server"
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

export const maxDuration = 200

const ROUNDS_MAX = 5

// ── POST /api/super-admin/crm/prospects/discover/jobs ─────────────────────────
// Creates a research job and immediately returns the job ID. Round 1 runs in
// the background via next/server `after()` — Rachel's browser does not need to
// stay connected. The cron at */2 * * * * handles rounds 2–N.
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

    // Create list + job in one transaction; job starts 'running' so the cron
    // won't claim it while after() is working on round 1.
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
          budgetUsd:         3.0,
          status:            "running",
          lockedAt:          new Date(),
          lockedUntil:       new Date(Date.now() + 240_000), // 4-min lock covers both rounds in after()
        },
      })

      return { job, list }
    })

    // ── Run rounds 1–2 after the response is sent ────────────────────────────
    // `after()` runs within the same Vercel invocation (up to maxDuration=200s).
    // Running 2 rounds here (each ~25-45s) means users get initial results without
    // depending on the cron. The cron handles rounds 3+ for any remaining gap.
    // If this invocation is killed mid-flight, lockedUntil expires and stale-lock
    // recovery in the cron resets the job to pending for retry.
    after(async () => {
      try {
        const batchOpts = await buildBatchOpts(criteria)
        let state: AgentState  = EMPTY_AGENT_STATE
        let acceptedCount      = 0
        let inputTokensTotal   = 0
        let outputTokensTotal  = 0
        let searchCallsTotal   = 0

        // ── Round 1 ─────────────────────────────────────────────────────
        const round1 = await runResearchRound({
          apiKey,
          criteria,
          state,
          roundNum:        1,
          needed:          criteria.requestedCount,
          listId:          list.id,
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

        acceptedCount    += round1.accepted.length
        inputTokensTotal  = round1.inputTokens
        outputTokensTotal = round1.outputTokens
        searchCallsTotal  = round1.searchCalls

        const continueToRound2 = shouldRunNextRound(
          1, ROUNDS_MAX, acceptedCount, criteria.requestedCount, job.createdAt,
          15 * 60 * 1000, inputTokensTotal, outputTokensTotal, searchCallsTotal, 3.0,
        )

        if (!continueToRound2) {
          await prisma.prospectResearchJob.update({
            where: { id: job.id },
            data: {
              status:           "completed",
              roundsCompleted:  1,
              acceptedCount,
              agentState:       state as object,
              inputTokensTotal,
              outputTokensTotal,
              searchCallsTotal,
              failedRounds:     0,
              lockedUntil:      null,
              lockedAt:         null,
            },
          })
          console.log(`[jobs] round 1 done (complete): accepted=${acceptedCount}`)
          return
        }

        // ── Persist round 1 results, extend lock, start round 2 ─────────
        // Keep status="running" so the cron cannot claim the job mid-flight.
        // The UI reads roundsCompleted=1 and shows "Round 2 of 5 — researching..."
        await prisma.prospectResearchJob.update({
          where: { id: job.id },
          data: {
            status:           "running",
            roundsCompleted:  1,
            acceptedCount,
            agentState:       state as object,
            inputTokensTotal,
            outputTokensTotal,
            searchCallsTotal,
            failedRounds:     0,
            lockedUntil:      new Date(Date.now() + 180_000), // 3-min fresh lock covers round 2
          },
        })

        // ── Round 2 ─────────────────────────────────────────────────────
        const round2 = await runResearchRound({
          apiKey,
          criteria,
          state,
          roundNum:        2,
          needed:          criteria.requestedCount - acceptedCount,
          listId:          list.id,
          batchOpts,
          listSearchState: criteria.stateProvince ?? null,
        })

        state = updateAgentState(
          state,
          round2.allCandidates,
          round2.accepted,
          round2.crmFiltered,
          round2.geoFiltered,
          2,
          round2.subsectors,
          round2.sourceStrategy,
        )

        acceptedCount     += round2.accepted.length
        inputTokensTotal  += round2.inputTokens
        outputTokensTotal += round2.outputTokens
        searchCallsTotal  += round2.searchCalls

        const continueToRound3 = shouldRunNextRound(
          2, ROUNDS_MAX, acceptedCount, criteria.requestedCount, job.createdAt,
          15 * 60 * 1000, inputTokensTotal, outputTokensTotal, searchCallsTotal, 3.0,
        )

        await prisma.prospectResearchJob.update({
          where: { id: job.id },
          data: {
            status:           continueToRound3 ? "pending" : "completed",
            roundsCompleted:  2,
            acceptedCount,
            agentState:       state as object,
            inputTokensTotal,
            outputTokensTotal,
            searchCallsTotal,
            failedRounds:     0,
            lockedUntil:      null,
            lockedAt:         null,
          },
        })

        console.log(`[jobs] rounds 1–2 done: accepted=${acceptedCount} continue=${continueToRound3}`)

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[jobs] initial rounds error:", msg)
        // Reset to pending for cron retry (up to 3 consecutive failures before permanent fail)
        const current = await prisma.prospectResearchJob.findUnique({
          where:  { id: job.id },
          select: { failedRounds: true },
        })
        const newFailed = (current?.failedRounds ?? 0) + 1
        await prisma.prospectResearchJob.update({
          where: { id: job.id },
          data: {
            status:       newFailed >= 3 ? "failed" : "pending",
            lastError:    msg.slice(0, 2000),
            failedRounds: newFailed,
            lockedUntil:  null,
            lockedAt:     null,
          },
        })
      }
    })

    // ── Return immediately ────────────────────────────────────────────────────
    return NextResponse.json({
      jobId:           job.id,
      listId:          list.id,
      jobStatus:       "pending",
      roundsCompleted: 0,
      roundsMax:       ROUNDS_MAX,
      companies:       [],
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
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
