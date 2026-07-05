/**
 * Bank feed integration status.
 *
 * Returns connected Plaid accounts for the selected entity, their last-sync
 * timestamp, and a "ready for auto-sync" flag.
 *
 * === EXTENSION POINT: Automatic Daily Feed Sync ===
 * When production Plaid credentials are set and the feed should run automatically:
 *   1. Set PLAID_ENV=production (currently defaults to sandbox).
 *   2. Implement a cron/queue job that calls syncBankTransactions() from lib/banking.ts
 *      for each active BankAccount.
 *   3. Store the webhook URL (POST /api/banking/sync) in Plaid's item settings —
 *      Plaid will push transaction updates instead of requiring polling.
 *   4. The /api/banking/sync route already exists and calls syncBankTransactions.
 *
 * This route is read-only — it only surfaces the current state.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId")

  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 })

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId: session.tenantId, entityId, isActive: true },
    select: {
      id: true,
      name: true,
      lastSyncedAt: true,
      plaidItemId: true,
      plaidAccountId: true,
      ledgerAccountId: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  })

  const plaidConfigured = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
  const plaidEnv = process.env.PLAID_ENV ?? "sandbox"
  const plaidProduction = plaidEnv === "production"

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      isLinked: !!(a.plaidItemId && a.plaidAccountId),
      lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
      ledgerAccountId: a.ledgerAccountId,
    })),
    plaidConfigured,
    plaidEnv,
    autoSyncReady: plaidConfigured && plaidProduction,
    autoSyncNote: plaidProduction
      ? "Production Plaid configured. Set up webhook at /api/banking/sync for automatic daily feed."
      : plaidConfigured
        ? "Plaid is in sandbox mode. Switch PLAID_ENV=production for live bank feeds."
        : "PLAID_CLIENT_ID / PLAID_SECRET not set. Configure Plaid credentials to enable bank feeds.",
  })
}
