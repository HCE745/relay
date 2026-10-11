import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listServiceRequests } from "@/lib/data/service-requests"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { InboxIcon } from "@/components/ui/icons"
import { ServiceRequestsClient } from "@/components/service-requests/service-requests-client"

export const dynamic = "force-dynamic"
const CAP = "core.jobs"

export default async function ServiceRequestsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Service requests" /><UpgradeNotice capability={CAP} /></div>)
  }
  const requests = await listServiceRequests(orgId)

  return (
    <div>
      <PageHeader title="Service requests" subtitle="Customer reschedule & cancellation requests awaiting approval" icon={<InboxIcon />} />
      <ServiceRequestsClient
        requests={requests.map((r) => ({
          id: r.id, type: r.type, status: r.status, requestedDate: r.requestedDate, requestedTime: r.requestedTime, note: r.note,
          customer: r.customer.name, jobTitle: r.job.title, siteName: r.job.serviceLocation.name, scheduledStart: r.job.scheduledStart.toISOString(),
        }))}
      />
    </div>
  )
}
