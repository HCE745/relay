import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Megaphone, Siren, Users, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CommunicationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [announcementCount, activeEmergencies] = await Promise.all([
    prisma.announcement.count({
      where: {
        orgId: session.organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        acknowledgments: {
          none: { userId: session.userId },
        },
      },
    }),
    prisma.emergencyBroadcast.count({
      where: { orgId: session.organizationId, resolvedAt: null },
    }),
  ])

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  return (
    <div>
      <Header title="Communications" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Communications</h1>
        <p className="text-sm text-gray-500 mt-0.5">Announcements, emergency broadcasts, and team channels</p>
      </div>

      {activeEmergencies > 0 && (
        <Link
          href="/communications/emergency"
          className="block bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-xl p-5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Siren className="w-6 h-6 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-bold text-red-700 dark:text-red-300">
                {activeEmergencies} Active Emergency{activeEmergencies !== 1 ? " Broadcasts" : " Broadcast"}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">Tap to view and acknowledge</p>
            </div>
            <ArrowRight className="w-5 h-5 text-red-500" />
          </div>
        </Link>
      )}

      <div className="grid gap-4">
        <Link
          href="/communications/announcements"
          className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
        >
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">Announcements</span>
              {announcementCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                  {announcementCount} unread
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Org-wide and scoped announcements</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </Link>

        <Link
          href="/communications/emergency"
          className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:border-red-300 dark:hover:border-red-700 transition-colors group"
        >
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Siren className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">Emergency Broadcasts</span>
              {activeEmergencies > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                  {activeEmergencies} active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Fire, evacuation, and critical alerts</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </Link>

        <Link
          href="/communications/teams"
          className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:border-purple-300 dark:hover:border-purple-700 transition-colors group"
        >
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-gray-900 dark:text-white">Team Channels</span>
            <p className="text-sm text-gray-500 mt-0.5">Your direct reports and supervisor channels</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </Link>
      </div>

      {canCreate && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-wrap gap-3">
          <Link
            href="/communications/announcements/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            New Announcement
          </Link>
          <Link
            href="/communications/emergency?create=1"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Emergency Broadcast
          </Link>
        </div>
      )}
      </div>
    </div>
  )
}
