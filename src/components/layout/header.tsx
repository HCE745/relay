import { Bell, Plus, Lightbulb } from "lucide-react"
import { getDisplaySession } from "@/lib/session"
import Link from "next/link"
import { GlobalSearchTrigger } from "@/components/layout/global-search-trigger"
import { SupportButton } from "@/components/support/support-button"

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export async function Header({ title, actions }: HeaderProps) {
  const session = await getDisplaySession()

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          {actions}
          <GlobalSearchTrigger />
          <Link
            href="/issues/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Report Issue</span>
          </Link>
          <Link
            href="/suggestions"
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">Suggest</span>
          </Link>
          <SupportButton
            userName={session?.displayName ?? ""}
            triggerClassName="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          />
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <Bell className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {session?.displayName?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{session?.displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{session?.displayTitle}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
