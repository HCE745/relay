import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SalesSidebar } from "./sidebar"

export const dynamic = "force-dynamic"

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const isManager = !!session.superAdmin || session.salesUserRole === "admin_sales"

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <SalesSidebar name={session.name ?? ""} email={session.email ?? ""} isManager={isManager} />
      <main className="flex-1 md:ml-64 overflow-y-auto bg-gray-950">
        <div className="md:hidden h-14" />
        {children}
      </main>
    </div>
  )
}
