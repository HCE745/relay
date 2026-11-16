import Link from "next/link"
import { consumeEmailVerification } from "@/lib/data/email-verification"

// Email verification landing page (Phase E). Consumes the single-use token from
// the emailed link, activating the owner's account. No session is created here —
// the person signs in afterward with the password they chose at signup.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const result = token ? await consumeEmailVerification(token) : { ok: false as const }

  const success = result.ok
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
          C
        </div>
        {success ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">
              {result.ok && result.alreadyVerified ? "Already verified" : "Email verified"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Your account is active. Sign in to start your trial.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition hover:opacity-90"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
            <p className="mt-1 text-sm text-slate-500">
              This verification link is no longer valid. Please sign up again or contact support.
            </p>
            <Link href="/signup" className="mt-5 inline-block text-sm font-medium text-brand hover:underline">
              Back to sign-up
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
