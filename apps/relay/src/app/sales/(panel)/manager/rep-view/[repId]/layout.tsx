import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import Link from "next/link"
import { ArrowLeft, Eye, LayoutDashboard, Building2, Briefcase, Mail, Bell, Users } from "lucide-react"

export const dynamic = "force-dynamic"

const REP_VIEW_TABS = [
  { label: "Overview",      href: "",            icon: LayoutDashboard },
  { label: "Prospects",     href: "/prospects",  icon: Building2 },
  { label: "Opportunities", href: "/opportunities", icon: Briefcase },
  { label: "Email",         href: "/email",      icon: Mail },
  { label: "Follow-Ups",    href: "/follow-ups", icon: Bell },
  { label: "Activity",      href: "/activity",   icon: Users },
]

export default async function RepViewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const { viewingRep } = view
  const basePath = `/sales/manager/rep-view/${repId}`

  return (
    <div className="flex flex-col h-full">
      {/* Read-only banner */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-2.5 bg-amber-950/70 border-b border-amber-800/50 backdrop-blur-sm">
        <Eye className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="flex-1 text-sm text-amber-300 font-medium">
          Viewing <span className="text-amber-100">{viewingRep.name}</span>&apos;s workspace — read only
        </p>
        <Link
          href="/sales/manager/rep-view"
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-200 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit
        </Link>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b border-gray-800 px-5 overflow-x-auto">
        {REP_VIEW_TABS.map(tab => {
          const href = `${basePath}${tab.href}`
          return (
            <Link
              key={tab.href}
              href={href}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors whitespace-nowrap"
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
