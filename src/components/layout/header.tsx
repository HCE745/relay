import { Bell, Plus, Sparkles } from "lucide-react"
import { getDisplaySession } from "@/lib/session"
import Link from "next/link"
import { GlobalSearchTrigger } from "@/components/layout/global-search-trigger"
import { SupportButton } from "@/components/support/support-button"

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export async function Header({ title, subtitle, actions }: HeaderProps) {
  const session = await getDisplaySession()

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-[13px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <GlobalSearchTrigger />
          <Link
            href="/issues/new"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-px text-white text-sm font-semibold rounded-lg transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Report Issue</span>
          </Link>
          <Link
            href="/suggestions"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 hover:shadow-md hover:-translate-y-px text-white text-sm font-semibold rounded-lg transition-all duration-150"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Suggest</span>
          </Link>
          <SupportButton
            userName={session?.displayName ?? ""}
            triggerClassName="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          />
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-semibold">
                {session?.displayName?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{session?.displayName}</p>
              <p className="text-xs text-gray-400 capitalize leading-tight">{session?.displayTitle}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
