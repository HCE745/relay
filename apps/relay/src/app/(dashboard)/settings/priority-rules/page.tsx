import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { PriorityRulesClient } from "./priority-rules-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PriorityRulesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  const [org, locations, departments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { priorityRulesConfig: true },
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
          <h1 className="text-xl font-bold text-gray-900">Priority Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set minimum priority levels for certain issue types. Rules raise priority — they never lower it. AI inference still runs first; rules only elevate if the AI-assigned priority is lower.
          </p>
        </div>
        <PriorityRulesClient
          initialRules={org?.priorityRulesConfig ?? []}
          locations={locations}
          departments={departments}
        />
      </div>
    </div>
  )
}
