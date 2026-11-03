import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { experienceForRole } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { logout } from "@/lib/auth-actions"

export const dynamic = "force-dynamic"

// The field app is a deliberately minimal, touch-first experience for cleaners.
// No ERP sidebar, no management navigation — one column, big targets.
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  // Management roles never see the field app.
  if (experienceForRole(session.role) !== "field") redirect("/dashboard")

  // Field app ACCESS is an entitlement (workforce.mobileFieldApp), enforced here
  // at the single entry point for every field page — so the capability actually
  // gates access rather than being merely declarative. A cleaner whose org lacks
  // it (e.g. revoked via override, or a tier below Essentials) has nowhere else
  // to land — management pages bounce them — so we render a plain in-shell notice
  // with sign-out instead of redirecting into a loop.
  if (!(await orgHasCapability(session.organizationId, "workforce.mobileFieldApp"))) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Field app not enabled</h1>
        <p className="text-sm text-slate-600">
          Your organization’s plan does not include mobile field access. Please contact your
          administrator.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    )
  }

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
