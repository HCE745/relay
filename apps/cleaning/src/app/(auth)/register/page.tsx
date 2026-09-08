import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { RegisterForm } from "./register-form"

export default async function RegisterPage() {
  const session = await getSession()
  if (session) redirect("/dashboard")
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Set up your company</h1>
          <p className="mt-1 text-sm text-slate-500">Create your organization and owner account.</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  )
}
