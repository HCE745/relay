"use client"
import { useActionState } from "react"
import { portalLoginAction } from "@/lib/portal-actions"

export function PortalLoginForm() {
  const [state, action, pending] = useActionState(portalLoginAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Email</span>
        <input name="email" type="email" required autoComplete="email" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand-700 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  )
}
