import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { landingPathForRole } from "@/lib/rbac"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect(landingPathForRole(session.role))

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-semibold text-slate-900">HCE Cleaning</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
