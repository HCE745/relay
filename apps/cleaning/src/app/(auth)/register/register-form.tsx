"use client"

import { useActionState } from "react"
import Link from "next/link"
import { registerOrg, type RegisterResult } from "@/lib/bootstrap-actions"
import { listTimezones } from "@/lib/scheduling/timezones"

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterResult, FormData>(registerOrg, undefined)
  const zones = listTimezones()

  return (
    <form action={action} className="space-y-4">
      <Field label="Company name">
        <input name="orgName" required className={input} placeholder="Summit Facility Services" />
      </Field>
      <Field label="Your name">
        <input name="name" required className={input} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={input} />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input name="password" type="password" required autoComplete="new-password" minLength={8} className={input} />
      </Field>
      <Field label="Timezone">
        <select name="timezone" defaultValue="America/New_York" className={input}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Setup code" hint="Provided by your HCE Cleaning contact">
        <input name="bootstrapToken" required className={input} />
      </Field>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create company"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}
