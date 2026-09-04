import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { CustomViewsClient } from "./custom-views-client"

export const dynamic = "force-dynamic"

export default async function CustomViewsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  if (isWashEssentials(session.productLine ?? "RELAY_STANDARD")) {
    return (
      <div>
        <Header title="Custom Views" />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-500 text-sm">Custom Views are available on Full Relay editions.</p>
        </div>
      </div>
    )
  }

  const [views, locations] = await Promise.all([
    prisma.customView.findMany({
      where:   { organizationId: session.organizationId },
      orderBy: [{ sidebarOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.location.findMany({
      where:   { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ])

  return (
    <div>
      <Header title="Custom Views" />
      <CustomViewsClient
        initialViews={views.map(v => ({
          id:           v.id,
          name:         v.name,
          icon:         v.icon,
          filters:      (v.filters ?? {}) as Record<string, unknown>,
          columns:      Array.isArray(v.columns) ? v.columns as string[] : null,
          sortField:    v.sortField,
          sortDir:      v.sortDir,
          showInSidebar: v.showInSidebar,
          sidebarOrder: v.sidebarOrder,
          createdAt:    v.createdAt.toISOString(),
        }))}
        locations={locations}
      />
    </div>
  )
}
