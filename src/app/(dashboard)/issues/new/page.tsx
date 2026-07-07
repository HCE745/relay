import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { NewIssueForm } from "@/components/issues/new-issue-form"

export const dynamic = "force-dynamic"

export default async function NewIssuePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId

  const [locations, departments, assets, vendors, users, org, userSettings, userLocations, sops, issueTemplates] = await Promise.all([
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.asset.findMany({ where: { organizationId: orgId, status: { not: "RETIRED" } }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, email: true, department: { select: { name: true } }, location: { select: { name: true } } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true } }),
    prisma.userSettings.findUnique({ where: { userId: session.userId }, select: { aiSuggestionsOn: true } }),
    prisma.userLocation.findMany({
      where: { userId: session.userId },
      include: { location: { select: { id: true, name: true } } },
    }),
    prisma.sOP.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, title: true, category: true },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    }),
    prisma.issueTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, priority: true, descriptionTemplate: true },
    }),
  ])

  const policy = org?.aiSuggestionsPolicy ?? "user_choice"
  const aiSuggestionsEnabled =
    !!org?.aiSuggestionsAvailable &&
    (policy === "on_all" || (policy === "user_choice" && (userSettings?.aiSuggestionsOn ?? true)))

  // Only pass assigned locations for non-admin users (admins can pick any location)
  const isAdmin = ["ADMIN", "HR", "MANAGER"].includes(session.role)
  const assignedLocations = !isAdmin && userLocations.length > 0
    ? userLocations.map(ul => ul.location)
    : undefined

  return (
    <div>
      <Header title="Report Issue" />
      {/* Mobile title */}
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Report an Issue</h1>
        <p className="text-sm text-gray-500 mt-0.5">Describe what needs attention</p>
      </div>
      <div className="px-3 md:px-6 py-2 md:py-6 max-w-2xl" data-tour="issue-form">
        <NewIssueForm
          locations={locations}
          departments={departments}
          assets={assets}
          vendors={vendors}
          users={users.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, department: u.department?.name ?? undefined, location: u.location?.name ?? undefined }))}
          aiSuggestionsEnabled={aiSuggestionsEnabled}
          assignedLocations={assignedLocations}
          sops={sops}
          issueTemplates={issueTemplates}
        />
      </div>
    </div>
  )
}
