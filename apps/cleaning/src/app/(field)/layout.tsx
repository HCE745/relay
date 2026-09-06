import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { experienceForRole } from "@/lib/rbac"
import { logout } from "@/lib/auth-actions"

export const dynamic = "force-dynamic"

// The field app is a deliberately minimal, touch-first experience for cleaners.
// No ERP sidebar, no management navigation — one column, big targets.
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  // Management roles never see the field app.
  if (experienceForRole(session.role) !== "field") redirect("/dashboard")

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
      <header className="pt-safe sticky top-0 z-10 bg-brand text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/70">HCE Cleaning</div>
            <div className="text-sm font-semibold">{session.name}</div>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  )
}
