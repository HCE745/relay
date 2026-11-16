import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  buildBatchOpts,
  runResearchRound,
  updateAgentState,
  shouldRunNextRound,
  type AgentState,
  type JobCriteria,
  EMPTY_AGENT_STATE,
} from "@/lib/research-agent"

export const dynamic    = "force-dynamic"
export const maxDuration = 110

// Called every 2 minutes by Vercel cron.
// Finds the oldest pending research job, claims it, advances it by one round,
// then releases the lock (pending) or marks it complete/failed.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }

  const now = new Date()

  // 1. Auto-fail jobs that have been stuck or running too long (> 20 min)
  const staleThreshold = new Date(now.getTime() - 20 * 60 * 1000)
  await prisma.prospectResearchJob.updateMany({
    where: {
      status:    { in: ["pending", "running"] },
      createdAt: { lt: staleThreshold },
    },
    data: {
      status:    "failed",
      lastError: "Job timed out (exceeded 20-minute limit without completing)",
      lockedUntil: null,
    },
  })

  // 2. Release stale locks (worker crashed without releasing)
  await prisma.prospectResearchJob.updateMany({
    where: {
      status:      "running",
      lockedUntil: { lt: now },
    },
    data: { status: "pending", lockedUntil: null, lockedAt: null },
  })

  // 3. Find the oldest pending job
  const candidate = await prisma.prospectResearchJob.findFirst({
    where: {
      status: "pending",
      OR: [
        { lockedUntil: null },
        { lockedUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
  })

  if (!candidate) {
    return NextResponse.json({ ok: true, skipped: "no pending jobs" })
  }

  // 4. Claim the job atomically (guard against concurrent workers)
  const claimed = await prisma.prospectResearchJob.updateMany({
    where: {
      id:     candidate.id,
      status: "pending",
    },
    data: {
      status:      "running",
      lockedAt:    now,
      lockedUntil: new Date(now.getTime() + 180_000), // 3-minute lock
    },
  })

  if (claimed.count === 0) {
    // Another worker claimed it first
    return NextResponse.json({ ok: true, skipped: "job claimed by another worker" })
  }

  // Re-read with agentState
  const job = await prisma.prospectResearchJob.findUnique({ where: { id: candidate.id } })
  if (!job || !job.listId) {
    return NextResponse.json({ ok: false, error: "Job missing listId" }, { status: 500 })
  }

  const criteria: JobCriteria = {
    country:           job.country,
    stateProvince:     job.stateProvince   ?? undefined,
    industry:          job.industry,
    employeeCountMin:  job.employeeCountMin,
    employeeCountMax:  job.employeeCountMax,
    keywords:          job.keywords        ?? undefined,
    additionalContext: job.additionalContext ?? undefined,
    requestedCount:    job.requestedCount,
  }

  const state: AgentState = (job.agentState as AgentState | null) ?? { ...EMPTY_AGENT_STATE }
  const roundNum          = job.roundsCompleted + 1

  console.log(`[cron/prospect-research] advancing job ${job.id} to round ${roundNum}`)

  try {
    const batchOpts = await buildBatchOpts(criteria)

    const needed = criteria.requestedCount - job.acceptedCount

    const round = await runResearchRound({
      apiKey,
      criteria,
      state,
      roundNum,
      needed: Math.max(needed, 5), // always try for at least 5 to fill gaps
      listId: job.listId,
      batchOpts,
      listSearchState: criteria.stateProvince ?? null,
    })

    const newState = updateAgentState(
      state,
      round.allCandidates,
      round.accepted,
      round.crmFiltered,
      round.geoFiltered,
      roundNum,
      round.subsectors,
      round.sourceStrategy,
    )

    const newAccepted = job.acceptedCount + round.accepted.length
    const newRounds   = roundNum

    const newInputTokens  = job.inputTokensTotal  + round.inputTokens
    const newOutputTokens = job.outputTokensTotal + round.outputTokens
    const newSearchCalls  = job.searchCallsTotal  + round.searchCalls

    const continueJob = shouldRunNextRound(
      newRounds,
      job.roundsMax,
      newAccepted,
      criteria.requestedCount,
      job.createdAt,
      15 * 60 * 1000,
      newInputTokens,
      newOutputTokens,
      newSearchCalls,
      job.budgetUsd,
    )

    await prisma.prospectResearchJob.update({
      where: { id: job.id },
      data: {
        status:           continueJob ? "pending" : "completed",
        roundsCompleted:  newRounds,
        acceptedCount:    newAccepted,
        agentState:       newState as object,
        inputTokensTotal:  { increment: round.inputTokens },
        outputTokensTotal: { increment: round.outputTokens },
        searchCallsTotal:  { increment: round.searchCalls },
        failedRounds:      0,
        lockedUntil:       null,
        lockedAt:          null,
        lastError:         null,
      },
    })

    console.log(`[cron/prospect-research] job ${job.id} round ${roundNum} done: accepted=${newAccepted} continue=${continueJob}`)

    return NextResponse.json({
      ok:              true,
      jobId:           job.id,
      roundCompleted:  roundNum,
      accepted:        round.accepted.length,
      totalAccepted:   newAccepted,
      status:          continueJob ? "pending" : "completed",
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[cron/prospect-research] job ${job.id} round ${roundNum} error:`, msg)

    // Increment failedRounds; only mark permanently failed after 3 consecutive errors.
    // This lets transient API timeouts recover on the next cron invocation.
    const newFailed = (job.failedRounds ?? 0) + 1

    await prisma.prospectResearchJob.update({
      where: { id: job.id },
      data:  {
        status:       newFailed >= 3 ? "failed" : "pending",
        lastError:    msg.slice(0, 2000),
        failedRounds: newFailed,
        lockedUntil:  null,
        lockedAt:     null,
      },
    })

    return NextResponse.json({ ok: false, jobId: job.id, error: msg }, { status: 500 })
  }
}
