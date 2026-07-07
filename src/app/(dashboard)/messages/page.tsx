import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { MessagesClient } from "@/components/messages/messages-client"

export const dynamic = "force-dynamic"

export default async function MessagesPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  return (
    <div className="flex flex-col h-full">
      <MessagesClient
        currentUserId={session.userId}
        currentUserName={session.name}
        organizationId={session.organizationId}
      />
    </div>
  )
}
