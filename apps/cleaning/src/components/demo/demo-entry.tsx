"use client"

import { useActionState, useState } from "react"
import { enterDemo, reseedDemo } from "@/lib/demo/actions"

const MIX = [
  { v: 0, label: "All residential", desc: "Homes only — biweekly & monthly cleans" },
  { v: 1, label: "Mostly residential", desc: "75% homes, 25% commercial" },
  { v: 2, label: "Even mix", desc: "50/50 homes and commercial" },
  { v: 3, label: "Mostly commercial", desc: "25% homes, 75% offices, clinics, schools" },
  { v: 4, label: "All commercial", desc: "Offices, clinics, schools, light industrial" },
]

// Shared slider + submit. `mode="enter"` provisions a new demo org; `mode="reseed"`
// wipes and reseeds the visitor's existing one (with a confirm).
export function DemoEntry({ mode }: { mode: "enter" | "reseed" }) {
  const action = mode === "enter" ? enterDemo : reseedDemo
  const [state, formAction, pending] = useActionState(action, undefined)
  const [mix, setMix] = useState(3)
  const [confirming, setConfirming] = useState(false)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mix" value={mix} />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Data mix</label>
        <input type="range" min={0} max={4} step={1} value={mix} onChange={(e) => setMix(Number(e.target.value))} className="w-full accent-brand-700" />
        <div className="flex justify-between text-[10px] text-slate-400"><span>Residential</span><span>Commercial</span></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-sm font-semibold text-slate-800">{MIX[mix].label}</div>
          <div className="text-xs text-slate-500">{MIX[mix].desc}</div>
        </div>
      </div>

      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      {mode === "reseed" && !confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700">
          Reseed demo data…
        </button>
      ) : (
        <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Preparing your demo…" : mode === "enter" ? "Launch the demo" : "Yes, wipe & reseed"}
        </button>
      )}
      {mode === "reseed" && confirming ? (
        <p className="text-center text-xs text-slate-500">This permanently replaces all data in your demo workspace.</p>
      ) : null}
    </form>
  )
}
