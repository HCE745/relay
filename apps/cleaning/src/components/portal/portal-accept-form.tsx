"use client"
import { useActionState } from "react"
import { portalAcceptAction } from "@/lib/portal-actions"

export function PortalAcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(portalAcceptAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">New password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand-700 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Activating…" : "Activate account"}</button>
    </form>
  )
}
