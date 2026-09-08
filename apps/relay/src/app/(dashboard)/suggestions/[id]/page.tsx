import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { SuggestionDetailClient } from "./suggestion-detail-client"

export const dynamic = "force-dynamic"

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const isAdmin = session.role === "ADMIN" || session.role === "HR"

  const suggestion = await prisma.suggestion.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      submittedBy:      { select: { id: true, name: true } },
      routedToUser:     { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
    },
  })

  if (!suggestion) notFound()

  const canView =
    isAdmin ||
    suggestion.submittedById === session.userId ||
    suggestion.routedToUserId === session.userId

  if (!canView) redirect("/suggestions")

  const users = await prisma.user.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { recognition_enabled: true, plan: true },
  })

  const { isRecognitionEnabled } = await import("@/lib/pricing")
  const recognitionEnabled = isRecognitionEnabled(org?.plan ?? "essentials", org?.recognition_enabled ?? false)

  return (
    <div>
      <Header title="Suggestion Detail" />
      <div className="px-3 md:px-6 py-4 md:py-8 max-w-2xl">
        <SuggestionDetailClient
          suggestion={{
            id:                suggestion.id,
            type:              suggestion.type,
            content:           suggestion.content,
            status:            suggestion.status,
            adminNote:         suggestion.adminNote,
            detectedCategory:  suggestion.detectedCategory,
            routedNote:        suggestion.routedNote,
            assigneeApproaches: suggestion.assigneeApproaches,
            createdAt:         suggestion.createdAt.toISOString(),
            submittedBy:       suggestion.submittedBy,
            routedToUser:      suggestion.routedToUser,
            convertedToIssue:  suggestion.convertedToIssue,
          }}
          users={users}
          sessionUserId={session.userId}
          isAdmin={isAdmin}
          recognitionEnabled={recognitionEnabled}
        />
      </div>
    </div>
  )
}
