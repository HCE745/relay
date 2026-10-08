import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listQuoteRequests } from "@/lib/data/quote-requests"
import { getOrgSettings } from "@/lib/data/org"
import { systemDb } from "@/lib/org-db"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { LinkButton } from "@/components/ui/controls"
import { ClipboardListIcon } from "@/components/ui/icons"
import { QuotesClient, NewQuoteButton } from "@/components/quotes/quotes-client"

export const dynamic = "force-dynamic"
const CAP = "crm.quoting"

export default async function QuotesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Quotes" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [quotes, org] = await Promise.all([
    listQuoteRequests(orgId),
    systemDb.organization.findUnique({ where: { id: orgId }, select: { slug: true } }),
  ])
  void getOrgSettings
  const bookPath = org ? `/book/${org.slug}` : null

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Phone, online and in-person quote requests"
        icon={<ClipboardListIcon />}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href="/quotes/walkthrough" variant="secondary">On-site walkthrough</LinkButton>
            <NewQuoteButton />
          </div>
        }
      />
      {bookPath ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="text-slate-500">Public booking page:</span>
          <Link href={bookPath} target="_blank" className="font-medium text-brand hover:underline">{bookPath}</Link>
          <span className="text-xs text-slate-400">— share this link for online quote requests</span>
        </div>
      ) : null}
      <QuotesClient
        quotes={quotes.map((q) => ({
          id: q.id, source: q.source, contactName: q.contactName, contactPhone: q.contactPhone, contactEmail: q.contactEmail,
          city: q.city, state: q.state, propertyType: q.propertyType, sqft: q.sqft, frequency: q.frequency,
          status: q.status, outsideServiceArea: q.outsideServiceArea, convertedLeadId: q.convertedLeadId, convertedEstimateId: q.convertedEstimateId, createdAt: q.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
