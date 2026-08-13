"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

interface Props {
  checkId:       string
  promptText:    string
  category:      string
  categoryLabel: string
  categoryColor: string
  relayMentioned: boolean
  relayPosition:  number | null
  competitors:    string[]
  sources:        string[]
  rawResponse:    string
  provider:       string
}

export function ResultsClient(p: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="divide-y divide-gray-800/60">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors text-left group"
      >
        {/* Mentioned indicator */}
        <div className="mt-0.5 shrink-0">
          {p.relayMentioned
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <XCircle className="w-5 h-5 text-gray-600" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.categoryColor}`}>
              {p.categoryLabel}
            </span>
            {p.relayMentioned && (
              <span className="text-[10px] text-emerald-400 font-medium">
                Relay mentioned{p.relayPosition !== null ? ` (¶${p.relayPosition})` : ""}
              </span>
            )}
            {p.competitors.length > 0 && (
              <span className="text-[10px] text-gray-500">
                Also: {p.competitors.join(", ")}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 leading-snug">{p.promptText}</p>
        </div>

        <div className="mt-1 shrink-0 text-gray-600 group-hover:text-gray-400">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 bg-gray-950/60 space-y-3">
          {/* Sources */}
          {p.sources.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Sources Cited</p>
              <div className="flex flex-wrap gap-1.5">
                {p.sources.map((src, i) => {
                  let domain = src
                  try { domain = new URL(src).hostname.replace(/^www\./, "") } catch { /* ignore */ }
                  return (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-800/40 px-2 py-0.5 rounded-full">
                      {domain} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Raw response */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Raw Response ({p.provider})
            </p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                {p.rawResponse}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
