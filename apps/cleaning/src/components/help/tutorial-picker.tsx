"use client"

import { TUTORIAL_FLOWS } from "@/components/demo/tour/flows"

// Lists the guided walkthroughs. Each button carries the tour engine's
// data-action/data-flow so clicking it bubbles to the ProductTour document
// listener and starts that flow in the live app. We close the picker on click
// but DON'T stop propagation, so the same click reaches the engine.
export function TutorialPicker({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9500] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">Guided tutorials</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
          {TUTORIAL_FLOWS.map((flow) => (
            <button
              key={flow.id}
              data-action="start-cln-tutorial"
              data-flow={flow.id}
              onClick={onClose}
              className="flex w-full flex-col items-start gap-0.5 px-5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-900">{flow.label}</span>
              <span className="text-xs text-slate-500">{flow.description}</span>
            </button>
          ))}
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
          A walkthrough spotlights the real screens — click along and your data stays exactly as it is.
        </p>
      </div>
    </div>
  )
}
