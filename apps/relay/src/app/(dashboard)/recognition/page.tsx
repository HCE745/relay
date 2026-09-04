import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { formatDistanceToNow } from "date-fns"
import { Award, Globe, Lock } from "lucide-react"
import { isRecognitionEnabled } from "@/lib/pricing"

export const dynamic = "force-dynamic"

export default async function RecognitionPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { plan: true, recognition_enabled: true, name: true },
  })

  if (!isRecognitionEnabled(org?.plan ?? "essentials", org?.recognition_enabled ?? false)) {
    redirect("/voice")
  }

  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"

  const recognitions = await prisma.recognition.findMany({
    where: {
      organizationId: session.organizationId,
      ...(isAdminOrHR ? {} : {
        OR: [
          { visibility: "PUBLIC" },
          { recipientId: session.userId },
          { grantedById: session.userId },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      recipient:  { select: { id: true, name: true } },
      grantedBy:  { select: { id: true, name: true } },
      suggestion: { select: { id: true, content: true } },
    },
  })

  const publicRecognitions  = recognitions.filter(r => r.visibility === "PUBLIC")
  const privateRecognitions = recognitions.filter(r => r.visibility === "PRIVATE")

  return (
    <div>
      <Header title="Recognition" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Recognition</h1>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 max-w-3xl space-y-6">

        {/* Public wall */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Recognition Wall</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Public recognitions shared with the whole organization.
          </p>

          {publicRecognitions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No public recognitions yet.</p>
              <p className="text-xs text-gray-400 mt-1">When a suggestion is marked implemented, admins can recognize the contributor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publicRecognitions.map(r => (
                <div key={r.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900">{r.recipient.name}</span>
                        <span className="text-xs text-gray-400">recognized by {r.grantedBy.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-amber-900">{r.message}</p>
                      {r.suggestion && (
                        <p className="mt-1.5 text-xs text-amber-700 line-clamp-1 italic">
                          &ldquo;{r.suggestion.content}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Private recognitions — visible to admins/HR and recipients/grantors */}
        {privateRecognitions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Private Recognitions</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Visible only to you, the recipient, and admins.
            </p>
            <div className="space-y-3">
              {privateRecognitions.map(r => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900">{r.recipient.name}</span>
                        <span className="text-xs text-gray-400">from {r.grantedBy.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{r.message}</p>
                      {r.suggestion && (
                        <p className="mt-1.5 text-xs text-gray-500 line-clamp-1 italic">
                          &ldquo;{r.suggestion.content}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
