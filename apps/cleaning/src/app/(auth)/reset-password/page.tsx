import Link from "next/link"
import { ResetForm } from "./reset-form"

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Choose a new password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This reset link is missing its token.</p>
            <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
