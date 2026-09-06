import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { experienceForRole, navForRole } from "@/lib/rbac"
import { getOrgCapabilities } from "@/lib/entitlements-server"
import { CapabilityProvider } from "@/lib/entitlements"
import { AdminSidebar } from "@/components/layout/admin-sidebar"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  // Defense in depth — middleware already routes cleaners to the field app.
  if (experienceForRole(session.role) !== "admin") redirect("/today")

  const capabilities = await getOrgCapabilities(session.organizationId)
  const capSet = new Set(capabilities)
  const nav = navForRole(session.role, (cap) => capSet.has(cap))

  return (
    <CapabilityProvider capabilities={capabilities}>
      <div className="min-h-screen bg-slate-100">
        <AdminSidebar
          nav={nav}
          user={{ name: session.name, role: session.role }}
          packageTier={session.packageTier}
        />
        <div className="md:pl-64">
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </CapabilityProvider>
  )
}
