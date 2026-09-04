import { prisma } from "@/lib/prisma"
import { AcceptInviteForm } from "./accept-form"
import { RelayWordmark } from "@/components/logo"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ token: string }>
}

interface InviteInfo {
  email: string
  role: string
  organizationName: string
  departmentName: string | null
}

async function getInviteInfo(token: string): Promise<{ data: InviteInfo } | { error: string }> {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      department: { select: { name: true } },
    },
  })

  if (!invitation) return { error: "Invalid invitation link" }
  if (invitation.usedAt) return { error: "This invitation has already been used" }
  if (invitation.expiresAt < new Date()) return { error: "This invitation has expired" }

  return {
    data: {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      departmentName: invitation.department?.name ?? null,
    },
  }
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const result = await getInviteInfo(token)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <RelayWordmark height={38} />
          <p className="text-gray-500 text-sm mt-2">Operations Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {"error" in result ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitation Unavailable</h2>
              <p className="text-gray-500 text-sm">{result.error}</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">
                  Join {result.data.organizationName}
                </h1>
                <p className="text-sm text-gray-500">
                  You&apos;ve been invited as{" "}
                  <span className="font-medium text-gray-700">{result.data.role}</span>
                  {result.data.departmentName && (
                    <> in <span className="font-medium text-gray-700">{result.data.departmentName}</span></>
                  )}
                  . Create your account to get started.
                </p>
              </div>
              <AcceptInviteForm token={token} info={result.data} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
