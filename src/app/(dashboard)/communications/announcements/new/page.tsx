import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { AnnouncementForm } from "@/components/communications/announcement-form"

export const dynamic = "force-dynamic"

export default async function NewAnnouncementPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) redirect("/communications/announcements")

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <Link href="/communications/announcements" className="hover:text-gray-700 dark:hover:text-gray-300">Announcements</Link>
        <span>/</span>
        <span>New</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Announcement</h1>
      <AnnouncementForm />
    </div>
  )
}
