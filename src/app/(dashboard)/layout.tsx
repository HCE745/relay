import { redirect } from "next/navigation"
import { getEntityContext } from "@/lib/entity-context"
import { Sidebar } from "@/components/layout/Sidebar"
import { TourProvider } from "@/components/tour/TourProvider"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let ctx
  try {
    ctx = await getEntityContext()
  } catch {
    redirect("/login")
  }

  return (
    <TourProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          entities={ctx.entities}
          selectedEntityId={ctx.entityId}
          userName={ctx.session.userId}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </TourProvider>
  )
}
