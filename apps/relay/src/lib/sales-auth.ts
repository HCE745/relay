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
  isCrmImpersonation: boolean  // SA is viewing CRM as this rep (read-only, no sends)
}

export async function getSalesSession(): Promise<SalesSessionInfo | null> {
  const session = await getSession()
  if (!session) return null

  // ── CRM rep impersonation mode ──────────────────────────────────────────────
  // A super admin who chose "View CRM as Rep" gets a session with both
  // superAdmin=true AND crmImpersonatedSalesUserId set.  In this mode we return
  // the impersonated rep's data as the effective identity so all CRM data routes
  // naturally scope to that rep.  Callers that check isCrmImpersonation must
  // block destructive operations (email send, status changes, etc.).
  if (session.superAdmin && session.crmImpersonatedSalesUserId) {
    // Enforce time-bound expiry
    if (session.crmImpersonationExpiresAt) {
      const expiresAt = new Date(session.crmImpersonationExpiresAt)
      if (expiresAt < new Date()) {
        // Impersonation expired — fall through to normal SA path
      } else {
        const dbUser = await prisma.salesUser.findUnique({
          where:  { id: session.crmImpersonatedSalesUserId },
          select: { isActive: true, role: true, name: true, isDemo: true },
        })
        if (dbUser?.isActive) {
          const role = dbUser.role ?? "sales_rep"
          return {
            salesUserId: session.crmImpersonatedSalesUserId,
            salesUserRole: role,
            salesUserName: dbUser.name ?? "",
            isSuperAdmin: false,
            isManager: false, // impersonation is always rep-level access
            isRep: true,
            isDemo: dbUser.isDemo ?? false,
            isCrmImpersonation: true,
          }
        }
      }
    }
  }

  if (session.superAdmin) {
    return {
      salesUserId: "sa",
      salesUserRole: "super_admin",
      salesUserName: "Super Admin",
      isSuperAdmin: true,
      isManager: true,
      isRep: false,
      isDemo: false,
      isCrmImpersonation: false,
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
      isCrmImpersonation: false,
    }
  }

  return null
}

export function salesRepFilter(info: SalesSessionInfo) {
  if (info.isSuperAdmin || info.isManager) return {}
  return { assignedToId: info.salesUserId }
}
