import { getSalesSession, SalesSessionInfo } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export interface ManagerRepViewInfo {
  session: SalesSessionInfo
  viewingRep: { id: string; name: string; email: string; role: string }
  isReadOnly: true
}

/**
 * Authorize a manager's read-only access to a specific rep's workspace.
 *
 * Rules:
 * - Caller must be admin_sales or super_admin.
 * - Target rep must exist, be active, and have role "sales_rep".
 * - admin_sales may only view reps where rep.managerId === session.salesUserId.
 * - super_admin may view any rep.
 *
 * Returns null for any unauthorized or not-found case (treat as 403/404).
 */
export async function getManagerRepView(repId: string): Promise<ManagerRepViewInfo | null> {
  const session = await getSalesSession()
  if (!session) return null
  if (!session.isManager) return null

  const rep = await prisma.salesUser.findUnique({
    where: { id: repId },
    select: { id: true, name: true, email: true, role: true, isActive: true, managerId: true },
  })
  if (!rep || !rep.isActive) return null
  if (rep.role !== "sales_rep") return null

  // Managers may only view their assigned reps; super-admin is unrestricted.
  if (!session.isSuperAdmin) {
    if (rep.managerId !== session.salesUserId) return null
  }

  return {
    session,
    viewingRep: { id: rep.id, name: rep.name, email: rep.email, role: rep.role },
    isReadOnly: true,
  }
}
