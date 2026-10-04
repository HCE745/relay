import { PortalAcceptForm } from "@/components/portal/portal-accept-form"

export const dynamic = "force-dynamic"

export default async function PortalAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">Activate your portal account</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Choose a password to finish setting up</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {token ? <PortalAcceptForm token={token} /> : <p className="text-sm text-red-600">This invite link is missing its token.</p>}
      </div>
    </div>
  )
}
