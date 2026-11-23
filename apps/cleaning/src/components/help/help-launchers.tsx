"use client"

import { useState } from "react"
import { TUTORIAL_FLOWS } from "@/components/demo/tour/flows"
import { FeedbackDialog } from "./feedback-dialog"

// In-page launchers for the Help Center: start any guided walkthrough, or open
// the bug / feature dialogs. Tutorial buttons carry the tour engine's
// data-action so the click bubbles to the ProductTour document listener.
export function HelpLaunchers() {
  const [overlay, setOverlay] = useState<null | "BUG" | "FEATURE">(null)
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Guided walkthroughs</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {TUTORIAL_FLOWS.filter((f) => f.id !== "overview").map((flow) => (
            <button
              key={flow.id}
              data-action="start-cln-tutorial"
              data-flow={flow.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="text-sm font-semibold text-slate-900">{flow.label}</div>
              <div className="text-xs text-slate-500">{flow.description}</div>
            </button>
          ))}
        </div>
        <button data-action="start-cln-tour" className="mt-2 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Or take the full product tour →
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOverlay("BUG")} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
          Report a bug
        </button>
        <button onClick={() => setOverlay("FEATURE")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Request a feature
        </button>
      </div>

      {overlay ? <FeedbackDialog mode={overlay} onClose={() => setOverlay(null)} /> : null}
    </div>
  )
}
