import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-session"
import { PortalLoginForm } from "@/components/portal/portal-login-form"

export const dynamic = "force-dynamic"

export default async function PortalLoginPage() {
  if (await getPortalSession()) redirect("/portal")
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">Customer Portal</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Sign in to view your service</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PortalLoginForm />
      </div>
    </div>
  )
}
