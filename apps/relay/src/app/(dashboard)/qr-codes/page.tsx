import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { hasWashOrProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { QrCodesClient } from "./qr-codes-client"

export const dynamic = "force-dynamic"

export default async function QrCodesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  if (!hasWashOrProfessional(session.plan ?? "essentials", session.productLine)) {
    return (
      <div>
        <Header title="QR Codes" />
        <PlanGateContent feature="qr-codes" />
      </div>
    )
  }

  const [qrCodes, locations, departments, members, surveys, assets, org] = await Promise.all([
    prisma.qrCode.findMany({
      where: { organizationId: session.organizationId },
      include: {
        location:   { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        asset:      { select: { id: true, name: true } },
        survey:     { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
        _count:     { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.location.findMany({
      where:   { organizationId: session.organizationId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where:   { organizationId: session.organizationId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where:   { organizationId: session.organizationId, isActive: true },
      select:  { id: true, name: true, role: true, email: true, department: { select: { name: true } }, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.survey.findMany({
      where:   { organizationId: session.organizationId, status: "PUBLISHED" },
      select:  { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.asset.findMany({
      where:   { organizationId: session.organizationId, status: "OPERATIONAL" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { customer_voice_enabled: true },
    }),
  ])

  return (
    <div>
      <Header title="QR Codes" />
      <div className="p-6" data-tour="qr-list">
        <QrCodesClient
          qrCodes={qrCodes.map(q => ({
            id:                 q.id,
            name:               q.name,
            description:        q.description,
            token:              q.token,
            reportingMode:      q.reportingMode,
            routingMode:        q.routingMode,
            assignedToId:       q.assignedToId,
            assignedToName:     q.assignedTo?.name     ?? null,
            assignedToRole:     q.assignedTo?.role     ?? null,
            assignedToActive:   q.assignedTo?.isActive ?? true,
            locationId:         q.locationId,
            locationName:       q.location?.name ?? null,
            area:               q.area,
            departmentId:       q.departmentId,
            departmentName:     q.department?.name ?? null,
            assetId:            q.assetId,
            assetName:          q.asset?.name ?? null,
            defaultCategory:    q.defaultCategory,
            collectContactInfo: q.collectContactInfo,
            requireContactInfo: q.requireContactInfo,
            requirePhoto:       q.requirePhoto,
            isActive:           q.isActive,
            submissionCount:    q._count.submissions,
            createdAt:          q.createdAt.toISOString(),
            presentationMode:   q.presentationMode,
            enabledActions:     q.enabledActions,
            surveyId:           q.surveyId,
            surveyTitle:        q.survey?.title ?? null,
          }))}
          locations={locations}
          departments={departments}
          members={members.map(m => ({ id: m.id, name: m.name, role: m.role, email: m.email, department: m.department?.name ?? undefined, location: m.location?.name ?? undefined }))}
          surveys={surveys}
          assets={assets}
          customerVoiceEnabled={org?.customer_voice_enabled ?? false}
        />
      </div>
    </div>
  )
}
