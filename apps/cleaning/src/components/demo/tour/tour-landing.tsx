"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"

// Clears any saved tour state and sends the visitor to the dashboard, where the
// tour auto-starts from step 1. Used by the /demo/tour landing and restart.
export function StartTourButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter()
  function start() {
    try {
      sessionStorage.removeItem("cln-tour-dismissed")
      sessionStorage.removeItem("cln-tour-step")
      sessionStorage.removeItem("cln-tour-started")
    } catch { /* private mode */ }
    router.push("/dashboard")
  }
  return <button onClick={start} className={className}>{children}</button>
}

export function TourLanding() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Guided tour</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        A quick walk through the whole business, from a new lead all the way to getting paid and seeing your profit per site. About 25 stops; leave any time.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <StartTourButton className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Start the tour
        </StartTourButton>
        <Link href="/dashboard" className="text-xs font-medium text-slate-400 hover:text-slate-600">Skip, just take me in</Link>
      </div>
    </div>
  )
}
