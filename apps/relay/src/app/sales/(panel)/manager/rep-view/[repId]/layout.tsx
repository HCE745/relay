import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import Link from "next/link"
import { ArrowLeft, Eye } from "lucide-react"
import { RepViewTabNav } from "./tab-nav"

export const dynamic = "force-dynamic"

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

      <RepViewTabNav basePath={basePath} />

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
