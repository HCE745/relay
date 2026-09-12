import { getSession } from "@/lib/session"

export interface SalesSessionInfo {
  salesUserId: string
  salesUserRole: string
  salesUserName: string
  isSuperAdmin: boolean
  isManager: boolean    // admin_sales or superAdmin
  isRep: boolean
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
    }
  }

  if (session.salesUserId) {
    const role = session.salesUserRole ?? "sales_rep"
    return {
      salesUserId: session.salesUserId,
      salesUserRole: role,
      salesUserName: session.salesUserName ?? "",
      isSuperAdmin: false,
      isManager: role === "admin_sales",
      isRep: role === "sales_rep",
    }
  }

  return null
}

export function salesRepFilter(info: SalesSessionInfo) {
  if (info.isSuperAdmin || info.isManager) return {}
  return { assignedToId: info.salesUserId }
}
