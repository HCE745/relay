import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const ago24h  = new Date(now.getTime() - 24  * 60 * 60 * 1000)
  const ago90d  = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000)

  const [newHighFit, needsRefresh, neverContacted, totalProspects] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        aiFitScore: { gte: 70 },
        createdAt:  { gte: ago24h },
      },
      orderBy: { aiFitScore: "desc" },
      take:    10,
      include: { contacts: { take: 1 } },
    }),

    prisma.prospect.findMany({
      where: {
        dateResearched:  { lte: ago90d },
        currentCrmStatus: { notIn: ["customer", "not_interested", "do_not_contact"] },
      },
      take: 10,
    }),

    prisma.prospect.findMany({
      where: {
        lastOutreachDate: null,
        currentCrmStatus: "researched",
        aiFitScore:       { gte: 50 },
      },
      orderBy: { aiFitScore: "desc" },
      take:    15,
      include: { contacts: { take: 1 } },
    }),

    prisma.prospect.count(),
  ])

  // Combine newHighFit + neverContacted, deduplicate by id, sort by aiFitScore desc, take 5
  const seen = new Set<string>()
  const combined: typeof newHighFit = []
  for (const p of [...newHighFit, ...neverContacted]) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      combined.push(p as typeof newHighFit[number])
    }
  }
  const top5 = combined
    .sort((a, b) => (b.aiFitScore ?? 0) - (a.aiFitScore ?? 0))
    .slice(0, 5)

  return NextResponse.json({ newHighFit, needsRefresh, neverContacted, top5, totalProspects })
}

export async function POST() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch top 20 prospects by aiFitScore
  const prospects = await prisma.prospect.findMany({
    orderBy: { aiFitScore: "desc" },
    take:    20,
    select: {
      id:               true,
      companyName:      true,
      aiFitScore:       true,
      lastOutreachDate: true,
      currentCrmStatus: true,
      pipelineStage:    true,
      industry:         true,
    },
  })

  if (prospects.length === 0) {
    return NextResponse.json({ targets: [] })
  }

  const now = new Date()
  const prospectList = prospects.map((p, i) => {
    const daysSince = p.lastOutreachDate
      ? Math.floor((now.getTime() - p.lastOutreachDate.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return (
      `${i + 1}. id=${p.id} | company=${p.companyName} | fitScore=${p.aiFitScore ?? "N/A"}` +
      ` | status=${p.currentCrmStatus} | pipelineStage=${p.pipelineStage ?? "N/A"}` +
      ` | lastContact=${daysSince !== null ? `${daysSince}d ago` : "never"} | industry=${p.industry ?? "N/A"}`
    )
  }).join("\n")

  const client = new Anthropic()

  const message = await client.messages.create({
    model:      "claude-sonnet-5",
    max_tokens: 512,
    messages: [
      {
        role:    "user",
        content: `You are a sales prioritization assistant. Select the best 5 prospects to contact today from the list below.

Prioritization criteria (in order of importance):
1. Prospects never contacted (lastContact = never) with high fit scores
2. High fit score (closer to 100 is better)
3. Prospects not contacted recently (more days since last contact is higher priority)
4. Pipeline stage — earlier stages get priority unless fit score is very high

Prospect list:
${prospectList}

Respond with ONLY a JSON object in this exact format, no prose:
{"selectedIds": ["id1", "id2", "id3", "id4", "id5"]}`,
      },
    ],
  })

  let selectedIds: string[] = []
  try {
    const text = message.content.find(b => b.type === "text")?.text ?? ""
    const parsed = JSON.parse(text)
    selectedIds = Array.isArray(parsed.selectedIds) ? parsed.selectedIds.slice(0, 5) : []
  } catch {
    // Fallback: return top 5 by aiFitScore if parsing fails
    selectedIds = prospects.slice(0, 5).map(p => p.id)
  }

  // Fetch full prospect records for the selected IDs
  const targets = await prisma.prospect.findMany({
    where:   { id: { in: selectedIds } },
    include: { contacts: { take: 1 } },
  })

  // Preserve the AI's ordering
  const ordered = selectedIds
    .map(id => targets.find(t => t.id === id))
    .filter(Boolean)

  return NextResponse.json({ targets: ordered })
}
