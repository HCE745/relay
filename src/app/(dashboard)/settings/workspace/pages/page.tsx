import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { PagesClient } from "./pages-client"
import type { PageWidget } from "@/lib/widget-registry"

export const dynamic = "force-dynamic"

export default async function CustomPagesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  if (isWashEssentials(session.productLine ?? "RELAY_STANDARD")) {
    return (
      <div>
        <Header title="Custom Pages" />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-500 text-sm">Custom Pages are available on Full Relay editions.</p>
        </div>
      </div>
    )
  }

  const [pages, views, locations] = await Promise.all([
    prisma.customPage.findMany({
      where:   { organizationId: session.organizationId },
      orderBy: [{ sidebarOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.customView.findMany({
      where:   { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.location.findMany({
      where:   { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ])

  return (
    <div>
      <Header title="Custom Pages" />
      <PagesClient
        initialPages={pages.map(p => ({
          id:           p.id,
          name:         p.name,
          icon:         p.icon,
          description:  p.description,
          widgets:      Array.isArray(p.widgets) ? (p.widgets as unknown as PageWidget[]) : [],
          showInSidebar: p.showInSidebar,
          sidebarOrder: p.sidebarOrder,
          createdAt:    p.createdAt.toISOString(),
        }))}
        customViews={views}
        locations={locations}
      />
    </div>
  )
}
