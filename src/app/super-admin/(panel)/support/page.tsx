import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, CheckCircle, Clock, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SASupportPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const conversations = await prisma.supportConversation.findMany({
    include: {
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take:    1,
        include: { senderUser: { select: { name: true } } },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take:    100,
  })

  const withMeta = conversations.map(c => ({
    ...c,
    unread: c.messages[0]?.senderType === "user" && !c.messages[0].isRead,
  }))

  const openCount   = conversations.filter(c => c.status === "open").length
  const pendingCount = conversations.filter(c => c.status === "pending").length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">Customer support conversations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",     value: openCount,    icon: AlertCircle, color: "text-blue-600"  },
          { label: "Pending",  value: pendingCount, icon: Clock,       color: "text-amber-600" },
          { label: "Total",    value: conversations.length, icon: MessageSquare, color: "text-gray-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conversation list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {withMeta.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No support conversations yet</p>
          </div>
        )}
        {withMeta.map((conv, i) => {
          const lastMsg = conv.messages[0]
          return (
            <Link
              key={conv.id}
              href={`/super-admin/support/${conv.id}`}
              className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${i > 0 ? "border-t border-gray-100" : ""} ${conv.unread ? "bg-blue-50" : ""}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                conv.status === "open"     ? "bg-blue-100 text-blue-700"   :
                conv.status === "pending"  ? "bg-amber-100 text-amber-700" :
                                             "bg-gray-100 text-gray-500"
              }`}>
                {conv.organization.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${conv.unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                    {conv.organization.name}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    conv.status === "open"     ? "bg-blue-100 text-blue-700"   :
                    conv.status === "pending"  ? "bg-amber-100 text-amber-700" :
                                               "bg-gray-100 text-gray-500"
                  }`}>
                    {conv.status}
                  </span>
                  {conv.unread && (
                    <span className="ml-auto w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {lastMsg.senderType === "user"
                      ? (lastMsg.senderUser?.name ?? "User")
                      : "You"}{": "}
                    {lastMsg.body}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-gray-400 shrink-0">
                {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
