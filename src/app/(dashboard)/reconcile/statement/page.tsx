import { getEntityContext } from "@/lib/entity-context"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import nextDynamic from "next/dynamic"

export const dynamic = "force-dynamic"

const StatementScanPage = nextDynamic(
  () => import("@/components/banking/StatementScanPage").then((m) => ({ default: m.StatementScanPage })),
  { loading: () => <div className="p-6 text-gray-400 text-sm">Loading…</div> }
)

export default async function ReconcileStatementPage() {
  const { session, tenantId, entityId } = await getEntityContext()
  const denied = assertAccess(session, entityId, "read")
  if (denied) return denied

  const vendors = await prisma.vendor.findMany({
    where: { tenantId, entityId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  const expenseAccounts = await prisma.account.findMany({
    where: { tenantId, entityId, type: "EXPENSE", isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  })

  return <StatementScanPage entityId={entityId} vendors={vendors} expenseAccounts={expenseAccounts} />
}
