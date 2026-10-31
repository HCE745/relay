import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface SalesSessionInfo {
  salesUserId: string
  salesUserRole: string
  salesUserName: string
  isSuperAdmin: boolean
  isManager: boolean    // admin_sales or superAdmin
  isRep: boolean
  isDemo: boolean
}

export async function getSalesSession(): Promise<SalesSessionInfo | null> {
  const session = await getSession()
  if (!session) return null

  if (session.superAdmin) {
    return {
      salesUserId: "sa",
      salesUserRole: "super_admin",
      salesUserName: "Super Admin",
      isSuperAdmin: true,
      isManager: true,
      isRep: false,
      isDemo: false,
    }
  }

  if (session.salesUserId) {
    // Re-validate isActive on every request so deactivated users lose access
    // immediately even if they have an existing session cookie.
    const dbUser = await prisma.salesUser.findUnique({
      where:  { id: session.salesUserId },
      select: { isActive: true, role: true, name: true, isDemo: true },
    })
    if (!dbUser || !dbUser.isActive) return null

    const role = dbUser.role ?? session.salesUserRole ?? "sales_rep"
    return {
      salesUserId: session.salesUserId,
      salesUserRole: role,
      salesUserName: dbUser.name ?? session.salesUserName ?? "",
      isSuperAdmin: false,
      isManager: role === "admin_sales",
      isRep: role === "sales_rep",
      isDemo: dbUser.isDemo ?? session.isDemo ?? false,
    }
  }

  return null
}

export function salesRepFilter(info: SalesSessionInfo) {
  if (info.isSuperAdmin || info.isManager) return {}
  return { assignedToId: info.salesUserId }
}
