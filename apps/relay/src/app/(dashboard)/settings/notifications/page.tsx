import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { NotificationRulesClient } from "./notification-rules-client"
import { AckEscalationClient } from "./ack-escalation-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function NotificationRulesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  const [org, locations, departments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { notificationRulesConfig: true, ackEscalationConfig: true },
    }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div>
      <Header
        title=""
        actions={
          <Link href="/settings" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        }
      />
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Notification Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure who gets notified when issues are reported based on priority, category, location, or department.
          </p>
        </div>
        <NotificationRulesClient
          initialRules={org?.notificationRulesConfig ?? []}
          locations={locations}
          departments={departments}
        />

        <div className="mt-10">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Escalation</h2>
          <p className="text-sm text-gray-500 mb-4">
            Automatically alert additional people when a critical or high-priority issue remains unacknowledged.
          </p>
          <AckEscalationClient
            initialConfig={org?.ackEscalationConfig as Parameters<typeof AckEscalationClient>[0]["initialConfig"]}
          />
        </div>
      </div>
    </div>
  )
}
