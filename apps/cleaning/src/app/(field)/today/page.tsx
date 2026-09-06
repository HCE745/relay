import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

// Cleaner home: "Today's Work". Phase 0 shows the shell + the intended flow;
// live jobs, clock-in, and checklists are built in Phase 3.
export default async function TodayPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const flow = [
    "Select your assigned site",
    "Clock in",
    "View scope & checklist",
    "Complete the work",
    "Add a photo or note",
    "Report a problem (if needed)",
    "Clock out",
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Today&apos;s Work</h1>
        <p className="mt-1 text-sm text-slate-500">No jobs assigned yet.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-700">You&apos;re all set up</p>
        <p className="mt-1 text-sm text-slate-500">
          Assigned jobs will appear here starting in Phase 3.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Your day, step by step</h2>
        <ol className="mt-3 space-y-2">
          {flow.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              <span className="text-sm text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        disabled
        className="pb-safe w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white opacity-60"
      >
        Clock in — available in Phase 3
      </button>
    </div>
  )
}
