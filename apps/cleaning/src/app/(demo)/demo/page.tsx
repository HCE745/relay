import Link from "next/link"
import { getDemoSession } from "@/lib/demo-session"
import { exitDemo } from "@/lib/demo/actions"
import { DemoEntry } from "@/components/demo/demo-entry"

export const dynamic = "force-dynamic"

export default async function DemoLandingPage() {
  const session = await getDemoSession()

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">HCE Cleaning — Live Demo</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-500">
          Explore a fully-working cleaning ERP with realistic data — schedule, jobs, inspections, invoices, reports and more.
          Your demo is a private sandbox; click around and change anything. It disappears after 24 hours.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {session ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                You already have a demo workspace running. <Link href="/dashboard" className="font-semibold underline">Resume it →</Link>
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Change the data mix</h2>
                <DemoEntry mode="reseed" />
              </div>
              <form action={exitDemo} className="pt-2 text-center">
                <button className="text-xs font-medium text-slate-400 hover:text-slate-600">End demo & clear session</button>
              </form>
            </div>
          ) : (
            <DemoEntry mode="enter" />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">No signup, no email, no credit card. A sandbox org is created just for you.</p>
      </div>
    </div>
  )
}
