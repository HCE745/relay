import Link from "next/link"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listQrCodes } from "@/lib/data/qr-codes"
import { listAllSites } from "@/lib/data/service-locations"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { QrCodesManager, type QrRow } from "@/components/issues/qr-codes-manager"
import { InboxIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

export default async function QrPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="QR reporting" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [codes, sites] = await Promise.all([
    listQrCodes(session.organizationId),
    listAllSites(session.organizationId),
  ])
  const siteOptions = sites.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, customerName: s.customer.name }))
  const h = await headers()
  const baseUrl = process.env.CLEANING_APP_URL ?? `https://${h.get("host") ?? "your-app"}`

  return (
    <div>
      <PageHeader title="QR reporting" subtitle="Posted codes occupants scan to report a problem, no login" icon={<InboxIcon />} />
      <div className="mb-4">
        <Link href="/issues" className="text-sm font-medium text-brand hover:underline">← Back to issues</Link>
      </div>
      <QrCodesManager codes={codes as unknown as QrRow[]} sites={siteOptions} baseUrl={baseUrl} />
    </div>
  )
}
