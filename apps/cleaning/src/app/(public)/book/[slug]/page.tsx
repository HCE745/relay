import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { BookingForm } from "@/components/quotes/booking-form"

export const dynamic = "force-dynamic"

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true, name: true } })
  const available = org ? await orgHasCapability(org.id, "crm.quoting") : false

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {!org || !available ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">Online booking unavailable</p>
          <p className="mt-1 text-sm text-slate-500">This page isn&apos;t accepting online quote requests right now.</p>
        </div>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">{org.name}</h1>
          <p className="mx-auto mt-1 mb-6 max-w-sm text-center text-sm text-slate-500">Request a free cleaning quote — tell us about your space and we&apos;ll be in touch.</p>
          <BookingForm slug={slug} orgName={org.name} />
        </>
      )}
    </div>
  )
}
