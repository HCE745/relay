import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getQuoteRequest } from "@/lib/data/quote-requests"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge } from "@/components/ui/controls"
import { ClipboardListIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "crm.quoting"
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) redirect("/dashboard")
  const { id } = await params
  const q = await getQuoteRequest(session.organizationId, id)
  if (!q) notFound()

  const addr = [q.addressLine1, q.city && q.state ? `${q.city}, ${q.state}` : q.city || q.state, q.postalCode].filter(Boolean).join(" · ")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/quotes" className="text-sm text-slate-500 hover:text-brand">← Quotes</Link>
      <PageHeader
        title={q.contactName}
        subtitle={`${title(q.source)} · ${title(q.propertyType)}`}
        icon={<ClipboardListIcon />}
        action={<StatusBadge tone="info">{title(q.status)}</StatusBadge>}
      />

      {q.outsideServiceArea || q.excluded ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {q.outsideServiceArea ? "Outside service area. " : ""}{q.excluded ? `Matches an exclusion (${q.exclusionReason ?? "see notes"}).` : ""}
        </div>
      ) : null}

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        {q.contactPhone ? <Detail label="Phone" value={q.contactPhone} /> : null}
        {q.contactEmail ? <Detail label="Email" value={q.contactEmail} /> : null}
        {addr ? <Detail label="Address" value={addr} /> : null}
        {q.sqft ? <Detail label="Square footage" value={q.sqft.toLocaleString()} /> : null}
        <Detail label="Frequency wanted" value={q.frequency ? title(q.frequency) : "—"} />
        {q.notes ? <Detail label="Notes" value={q.notes} /> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Associated records</h2>
        {q.convertedLeadId || q.convertedEstimateId ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.convertedLeadId ? <LinkRow label="Converted to lead" href={`/leads`} value="View in Leads" /> : null}
            {q.convertedEstimateId ? <LinkRow label="Converted to estimate" href={`/estimates/${q.convertedEstimateId}`} value="Open estimate" /> : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not yet converted. Convert this quote to a lead or estimate from the Quotes list.</p>
        )}
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value}</dd></div>
}
function LinkRow({ label, href, value }: { label: string; href: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <Link href={href} className="text-sm font-medium text-brand-700 hover:text-brand-800">{value} →</Link>
    </div>
  )
}
