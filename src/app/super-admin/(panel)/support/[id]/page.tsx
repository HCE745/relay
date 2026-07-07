import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SASupportConvClient } from "@/components/super-admin/sa-support-conv"

export const dynamic = "force-dynamic"

export default async function SASupportConvPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const { id } = await params

  const conv = await prisma.supportConversation.findUnique({
    where:   { id },
    include: {
      organization: { select: { id: true, name: true, users: { select: { id: true, name: true, role: true }, take: 10 } } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderUser:  { select: { id: true, name: true } },
          senderAdmin: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!conv) notFound()

  // Mark user messages as read
  await prisma.supportMessage.updateMany({
    where: { supportConversationId: id, senderType: "user", isRead: false },
    data:  { isRead: true },
  })

  return (
    <SASupportConvClient
      conversation={conv as Parameters<typeof SASupportConvClient>[0]["conversation"]}
    />
  )
}
