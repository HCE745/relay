import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getSalesSession } from "@/lib/sales-auth"
import { SalesSidebar } from "./sidebar"
import { SalesTour } from "./SalesTour"
import { ImpersonationBanner } from "./ImpersonationBanner"

export const dynamic = "force-dynamic"

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  // Resolve the effective sales session (handles CRM impersonation)
  const salesSession = await getSalesSession()

  const isImpersonating = !!session.crmImpersonatedSalesUserId
  const isManager = !isImpersonating && (!!session.superAdmin || session.salesUserRole === "admin_sales")
  const isDemo = session.isDemo === true
  const defaultRole = isManager ? "manager" : "rep"

  // Display name: when impersonating, show the rep's name in the sidebar
  const displayName  = isImpersonating ? (salesSession?.salesUserName ?? "Rep") : (session.name ?? "")
  const displayEmail = isImpersonating ? "" : (session.email ?? "")

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {isImpersonating && (
        <ImpersonationBanner
          repName={salesSession?.salesUserName ?? "Rep"}
          expiresAt={session.crmImpersonationExpiresAt ?? null}
        />
      )}
      <SalesSidebar name={displayName} email={displayEmail} isManager={isManager} isDemo={isDemo} />
      <main className={`flex-1 md:ml-64 overflow-y-auto bg-gray-950${isImpersonating ? " pt-10" : ""}`}>
        <div className="md:hidden h-14" />
        {children}
      </main>
      {!isImpersonating && <SalesTour isDemo={isDemo} defaultRole={defaultRole} />}
    </div>
  )
}
