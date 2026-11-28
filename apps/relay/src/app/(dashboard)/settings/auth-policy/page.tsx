import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AuthPolicyClient, type AuthPolicyClientProps } from "./auth-policy-client"
import type { AuthPolicyConfig } from "@/lib/employee-session"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AuthPolicyPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { authPolicyConfig: true },
  })

  const rawPolicy = (org?.authPolicyConfig ?? null) as AuthPolicyConfig | null
  const policy = rawPolicy as AuthPolicyClientProps["initialPolicy"]

  return (
    <div>
      <Header title="Auth Policy" />
      <div className="p-6 max-w-2xl">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Employee Authentication Policy</h2>
          <p className="text-xs text-gray-400 mb-6">
            Configure how employees log in on kiosk devices. These settings apply org-wide; individual registered devices can override session timeouts.
          </p>
          <AuthPolicyClient initialPolicy={policy} />
        </div>
      </div>
    </div>
  )
}
