import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SuperAdminSidebar } from "./sidebar"

export const dynamic = "force-dynamic"

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <SuperAdminSidebar name={session.name} email={session.email} />
      <main className="flex-1 md:ml-60 overflow-y-auto bg-gray-950">
        <div className="md:hidden h-14" />
        {children}
      </main>
    </div>
  )
}
