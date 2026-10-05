import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SalesSidebar } from "./sidebar"
import { FlaskConical } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const isManager = !!session.superAdmin || session.salesUserRole === "admin_sales"
  const isDemo = session.isDemo === true

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <SalesSidebar name={session.name ?? ""} email={session.email ?? ""} isManager={isManager} />
      <main className="flex-1 md:ml-64 overflow-y-auto bg-gray-950">
        <div className="md:hidden h-14" />
        {isDemo && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-medium sticky top-0 z-40">
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span>
              This is a demo account with sample data. Some features are limited in demo mode.
            </span>
            <a href="/sales/settings" className="ml-auto underline underline-offset-2 hover:text-amber-200 whitespace-nowrap">
              Reset demo data →
            </a>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
