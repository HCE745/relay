import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { isPublicRegistrationEnabled } from "@/lib/registration"
import { SignUpForm } from "./signup-form"

export default async function SignUpPage() {
  const session = await getSession()
  if (session) redirect("/dashboard")

  const open = isPublicRegistrationEnabled()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Start your free trial</h1>
          <p className="mt-1 text-sm text-slate-500">14 days, no credit card required.</p>
        </div>
        {open ? (
          <SignUpForm />
        ) : (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">
            Self-service sign-up isn&rsquo;t open yet. Please contact CleanWare to get started.
          </p>
        )}
      </div>
    </main>
  )
}
