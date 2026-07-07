import { redirect, notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SopDetailView } from "./sop-detail-view"

export const dynamic = "force-dynamic"

export default async function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const isAdminLevel = ["ADMIN", "MANAGER"].includes(session.role)

  const sop = await prisma.sOP.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      department: { select: { id: true, name: true } },
      issues: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          sopViolation: true,
          sopMatchConfidence: true,
          sopViolationNote: true,
          createdAt: true,
          resolvedAt: true,
          sopComplianceOutcome: true,
          reportedBy: { select: { id: true, name: true } },
          asset: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { issues: true } },
    },
  })

  if (!sop) notFound()

  const [departments, assets] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: {
        organizationId: session.organizationId,
        ...(sop.assetType ? { type: sop.assetType } : {}),
      },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ])

  return (
    <div>
      <Header
        title=""
        actions={
          <Link href="/sops" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Back to SOP Library
          </Link>
        }
      />
      <div className="p-4 md:p-6 max-w-5xl">
        <SopDetailView
          sop={{
            id:                      sop.id,
            title:                   sop.title,
            description:             sop.description,
            category:                sop.category,
            assetType:               sop.assetType,
            content:                 sop.content,
            version:                 sop.version,
            uploadedFilename:        sop.uploadedFilename,
            aiImprovementSuggestion: sop.aiImprovementSuggestion,
            aiImprovementGeneratedAt: sop.aiImprovementGeneratedAt?.toISOString() ?? null,
            department:              sop.department,
            linkedIssueCount:        sop._count.issues,
            updatedAt:               sop.updatedAt.toISOString(),
            createdAt:               sop.createdAt.toISOString(),
            sections:                (sop.sections ?? null) as Array<{ index: number; heading: string; body: string }> | null,
            issues: sop.issues.map(i => ({
              id:                   i.id,
              title:                i.title,
              status:               i.status,
              priority:             i.priority,
              category:             i.category,
              sopViolation:         i.sopViolation,
              sopMatchConfidence:   i.sopMatchConfidence,
              sopViolationNote:     i.sopViolationNote,
              sopComplianceOutcome: i.sopComplianceOutcome,
              createdAt:            i.createdAt.toISOString(),
              resolvedAt:           i.resolvedAt?.toISOString() ?? null,
              reportedBy:           i.reportedBy,
              asset:                i.asset,
            })),
          }}
          departments={departments}
          relatedAssets={assets}
          isAdminLevel={isAdminLevel}
          canViewImprovement={["ADMIN", "MANAGER", "HR"].includes(session.role)}
        />
      </div>
    </div>
  )
}
