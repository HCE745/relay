import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { PageHeader } from "@/components/ui/placeholder"

const MANAGER_QUESTIONS = [
  "Who is working today?",
  "Which sites are being serviced?",
  "Which jobs are complete vs missed?",
  "Which inspections failed?",
  "What customer issues are open?",
  "What requires attention?",
]

const SUPERVISOR_QUESTIONS = [
  "Who is on my team today?",
  "Who has not clocked in?",
  "Are any shifts uncovered?",
  "Which jobs are complete vs missed?",
  "Which inspections do I need to run?",
  "What is waiting for my approval?",
]

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isSupervisor = session.role === "SUPERVISOR"
  const questions = isSupervisor ? SUPERVISOR_QUESTIONS : MANAGER_QUESTIONS

  return (
    <div>
      <PageHeader
        title={isSupervisor ? "Supervisor Dashboard" : "Dashboard"}
        subtitle={`Signed in as ${session.name} · ${session.role}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {questions.map((q) => (
          <div key={q} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-700">{q}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Operational metrics are wired to live data starting in Phase 6.
      </p>
    </div>
  )
}
