import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { BillForm } from "@/components/bills/BillForm"

export const dynamic = "force-dynamic"

export default async function NewBillPage() {
  // TEMP: verbose logging — remove after Vercel root cause is confirmed
  let tenantId: string
  let entityId: string
  try {
    const ctx = await getEntityContext()
    tenantId = ctx.tenantId
    entityId = ctx.entityId
    console.log("[bills/new] getEntityContext ok — tenantId:", tenantId, "entityId:", entityId)
  } catch (err) {
    console.error("[bills/new] getEntityContext FAILED:", err)
    throw err
  }

  let vendors: { id: string; name: string }[]
  let expenseAccounts: { id: string; code: string; name: string }[]
  let classes: { id: string; name: string }[]
  let departments: { id: string; name: string }[]
  try {
    ;[vendors, expenseAccounts, classes, departments] = await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId, entityId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.account.findMany({
        where: { tenantId, entityId, type: "EXPENSE", isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.class.findMany({
        where: { tenantId, entityId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.department.findMany({
        where: { tenantId, entityId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ])
    console.log("[bills/new] DB queries ok — vendors:", vendors.length, "accounts:", expenseAccounts.length)
  } catch (err) {
    console.error("[bills/new] DB queries FAILED:", err)
    throw err
  }

  // NOTE: if digest 4192462220 still appears AFTER these log lines, the error
  // is not in data fetching — it is thrown by React's RSC renderer when it
  // serializes <BillForm> and looks up BillForm in the React Client Manifest.
  // That means the deployed build predates BillForm.tsx or its manifest entry
  // is missing. Check Vercel Deployments to confirm 52d3666 is the active build.
  console.log("[bills/new] rendering <BillForm> — if 500 follows, the error is in the RSC client manifest, not here")

  return (
    <BillForm
      entityId={entityId}
      vendors={vendors}
      expenseAccounts={expenseAccounts}
      classes={classes}
      departments={departments}
    />
  )
}
