import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { experienceForRole, navForRole, canManageAccounts } from "@/lib/rbac"
import { HelpMenu } from "@/components/help/help-menu"
import { getOrgCapabilities } from "@/lib/entitlements-server"
import { CapabilityProvider } from "@/lib/entitlements"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { Breadcrumbs, WorkspaceSubnav } from "@/components/layout/workspace-nav"
import { DemoBanner } from "@/components/demo/demo-banner"
import { ProductTour } from "@/components/demo/tour/product-tour"
import { CommandPalette } from "@/components/command/command-palette"
import { PeekHost } from "@/components/peek/peek"

export const dynamic = "force-dynamic"

const NAV_COOKIE = "cln-nav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  // Defense in depth — middleware already routes cleaners to the field app.
  if (experienceForRole(session.role) !== "admin") redirect("/today")

  const capabilities = await getOrgCapabilities(session.organizationId)
  const capSet = new Set(capabilities)
  const nav = navForRole(session.role, (cap) => capSet.has(cap))
  const navClient = nav.map((n) => ({ key: n.key, label: n.label, href: n.href, section: n.section }))
  const collapsed = (await cookies()).get(NAV_COOKIE)?.value === "collapsed"

  return (
    <CapabilityProvider capabilities={capabilities}>
      {/* data-nav drives the rail width + content offset together (see globals.css). */}
      <div id="admin-shell" data-nav={collapsed ? "collapsed" : "expanded"} className="min-h-screen bg-slate-100">
        <AdminSidebar
          nav={nav}
          user={{ name: session.name, role: session.role }}
          packageTier={session.packageTier}
          initialCollapsed={collapsed}
        />
        <div className="nav-content">
          {session.isDemo ? <DemoBanner role={session.role} /> : null}
          {/* Contextual top bar: breadcrumbs + the active workspace's sub-nav. */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-3">
              <Breadcrumbs nav={navClient} />
              <HelpMenu canReviewFeedback={canManageAccounts(session.role)} />
            </div>
            <div className="mx-auto max-w-[1400px]">
              <WorkspaceSubnav nav={navClient} />
            </div>
          </div>
          {/* cln-ornament scopes the Victorian title/heading serif to the admin
              shell only — the field app and portal never get ornament. */}
          <main className="cln-ornament mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
        {/* Mounted for everyone: demo auto-starts the overview tour; in the live
            app it stays idle until Help → Guided Tutorials starts a flow. */}
        <ProductTour isDemo={session.isDemo ?? false} />
        <CommandPalette nav={nav.map((n) => ({ label: n.label, href: n.href }))} />
        <Suspense fallback={null}><PeekHost /></Suspense>
      </div>
    </CapabilityProvider>
  )
}
