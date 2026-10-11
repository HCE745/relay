import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { isSmsConfigured } from "@/lib/sms"
import { getUserPrefs } from "@/lib/data/notifications"
import { PageHeader } from "@/components/ui/placeholder"
import { NotificationPrefs } from "@/components/notifications/notification-prefs"

export const dynamic = "force-dynamic"

export default async function NotificationSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [prefs, hasCap] = await Promise.all([
    getUserPrefs(session.organizationId, session.userId),
    orgHasCapability(session.organizationId, "workforce.notifications"),
  ])
  const smsAvailable = hasCap && isSmsConfigured()

  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" subtitle="Choose how you want to be alerted" />
      <NotificationPrefs initial={prefs} smsAvailable={smsAvailable} />
    </div>
  )
}
