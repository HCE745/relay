import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

type PendingFlag = {
  sourceType: string
  sourceId: string
  reason: string
  severity: "LOW" | "MEDIUM" | "HIGH"
  ruleType: string
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json().catch(() => ({}))
  const tenantId = session.tenantId

  const entityId: string = body.entityId ?? (await getSelectedEntityId())

  const since = new Date()
  since.setDate(since.getDate() - 90)

  // Fetch last 90 days of bills with vendor
  const bills = await prisma.bill.findMany({
    where: { tenantId, entityId, date: { gte: since } },
    include: { vendor: true },
    orderBy: { date: "desc" },
  })

  // Fetch ALL historical bills for vendor median calc
  const allBills = await prisma.bill.findMany({
    where: { tenantId, entityId },
    select: { id: true, vendorId: true, total: true },
  })

  const pendingFlags: PendingFlag[] = []

  // ─── Rule 1: DUPLICATE (HIGH) ────────────────────────────────────────────
  for (let i = 0; i < bills.length; i++) {
    for (let j = i + 1; j < bills.length; j++) {
      const a = bills[i]
      const b = bills[j]
      if (a.vendorId !== b.vendorId) continue
      if (a.total !== b.total) continue
      const diffMs = Math.abs(a.date.getTime() - b.date.getTime())
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (diffDays <= 7) {
        for (const bill of [a, b]) {
          pendingFlags.push({
            sourceType: "BILL",
            sourceId: bill.id,
            reason: `Possible duplicate: same vendor (${bill.vendor.name}) and total ($${(bill.total / 100).toFixed(2)}) within 7 days of another bill.`,
            severity: "HIGH",
            ruleType: "DUPLICATE",
          })
        }
      }
    }
  }

  // ─── Rule 2: AMOUNT_OUTLIER (MEDIUM) ─────────────────────────────────────
  const billsByVendor: Record<string, number[]> = {}
  for (const b of allBills) {
    if (!billsByVendor[b.vendorId]) billsByVendor[b.vendorId] = []
    billsByVendor[b.vendorId].push(b.total)
  }

  for (const bill of bills) {
    const vendorTotals = billsByVendor[bill.vendorId] ?? []
    if (vendorTotals.length < 3) continue
    const med = median(vendorTotals)
    if (med > 0 && bill.total > med * 3) {
      pendingFlags.push({
        sourceType: "BILL",
        sourceId: bill.id,
        reason: `Amount outlier: $${(bill.total / 100).toFixed(2)} is more than 3× the vendor median of $${(med / 100).toFixed(2)} for ${bill.vendor.name}.`,
        severity: "MEDIUM",
        ruleType: "AMOUNT_OUTLIER",
      })
    }
  }

  // ─── Rule 3: ROUND_NUMBER (LOW) ───────────────────────────────────────────
  for (const bill of bills) {
    if (bill.total > 50000 && bill.total % 10000 === 0) {
      pendingFlags.push({
        sourceType: "BILL",
        sourceId: bill.id,
        reason: `Suspicious round number: $${(bill.total / 100).toFixed(2)} is exactly divisible by $100 and over $500.`,
        severity: "LOW",
        ruleType: "ROUND_NUMBER",
      })
    }
  }

  // ─── Rule 4: MISSING_VENDOR (MEDIUM) ─────────────────────────────────────
  for (const bill of bills) {
    if (!bill.vendorId || !bill.vendor?.name || bill.vendor.name.trim() === "") {
      pendingFlags.push({
        sourceType: "BILL",
        sourceId: bill.id,
        reason: `Bill has no vendor or vendor name is empty.`,
        severity: "MEDIUM",
        ruleType: "MISSING_VENDOR",
      })
    }
  }

  // ─── Rule 5: BACKDATED (MEDIUM) ───────────────────────────────────────────
  for (const bill of bills) {
    const diffMs = bill.createdAt.getTime() - bill.date.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > 60) {
      pendingFlags.push({
        sourceType: "BILL",
        sourceId: bill.id,
        reason: `Bill dated ${bill.date.toISOString().slice(0, 10)} was entered ${Math.round(diffDays)} days later (${bill.createdAt.toISOString().slice(0, 10)}), suggesting backdating into a possibly closed period.`,
        severity: "MEDIUM",
        ruleType: "BACKDATED",
      })
    }
  }

  // ─── AI Pass ──────────────────────────────────────────────────────────────
  const billIds = new Set(bills.map((b) => b.id))

  if (bills.length > 0) {
    try {
      const top50 = bills.slice(0, 50)
      const summary = top50
        .map(
          (b) =>
            `id:${b.id} vendor:"${b.vendor?.name ?? "Unknown"}" amount:$${(b.total / 100).toFixed(2)} date:${b.date.toISOString().slice(0, 10)} status:${b.status}`
        )
        .join("\n")

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const aiResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "You are an accounting anomaly detection assistant. You review bill data and flag suspicious items for human review. You are read-only — you never suggest edits, deletions, or approvals. Return ONLY a JSON array (no prose, no markdown). Each item must be: { sourceType: 'BILL'|'INVOICE', sourceId: string, reason: string, severity: 'LOW'|'MEDIUM'|'HIGH', ruleType: 'AI_FLAG' }. If nothing suspicious, return [].",
        messages: [
          {
            role: "user",
            content: `Review these bills and flag anything unusual (unexpected vendors, unusual patterns, suspicious timing, etc.). Return ONLY a JSON array.\n\n${summary}`,
          },
        ],
      })

      const rawText =
        aiResponse.content[0].type === "text" ? aiResponse.content[0].text.trim() : "[]"

      // Strip markdown code fences if present
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")

      let aiFlags: Array<{
        sourceType: string
        sourceId: string
        reason: string
        severity: string
        ruleType: string
      }> = []
      try {
        const parsed = JSON.parse(jsonText)
        if (Array.isArray(parsed)) aiFlags = parsed
      } catch {
        // Ignore parse errors — AI response was not valid JSON
      }

      for (const flag of aiFlags) {
        if (!billIds.has(flag.sourceId)) continue // Only accept known IDs
        const severity = ["LOW", "MEDIUM", "HIGH"].includes(flag.severity)
          ? (flag.severity as "LOW" | "MEDIUM" | "HIGH")
          : "MEDIUM"
        pendingFlags.push({
          sourceType: flag.sourceType ?? "BILL",
          sourceId: flag.sourceId,
          reason: flag.reason ?? "AI flagged this item for review.",
          severity,
          ruleType: "AI_FLAG",
        })
      }
    } catch {
      // AI pass failure is non-fatal — continue without it
    }
  }

  // ─── Deduplication & Save ─────────────────────────────────────────────────
  const existingFlags = await prisma.anomalyFlag.findMany({
    where: { tenantId, entityId, status: "OPEN" },
    select: { sourceId: true, ruleType: true },
  })
  const existingSet = new Set(existingFlags.map((f) => `${f.sourceId}::${f.ruleType}`))

  const seen = new Set<string>()
  const toCreate: PendingFlag[] = []
  for (const flag of pendingFlags) {
    const key = `${flag.sourceId}::${flag.ruleType}`
    if (existingSet.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    toCreate.push(flag)
  }

  if (toCreate.length > 0) {
    await prisma.anomalyFlag.createMany({
      data: toCreate.map((f) => ({
        tenantId,
        entityId,
        sourceType: f.sourceType,
        sourceId: f.sourceId,
        reason: f.reason,
        severity: f.severity,
        ruleType: f.ruleType,
        status: "OPEN",
      })),
    })
  }

  const allOpen = await prisma.anomalyFlag.findMany({
    where: { tenantId, entityId, status: "OPEN" },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({
    created: toCreate.length,
    totalOpen: allOpen.length,
    flags: allOpen,
  })
}
