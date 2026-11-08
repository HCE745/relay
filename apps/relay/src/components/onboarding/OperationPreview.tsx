"use client"

import { MapPin, Building2, ArrowRight, AlertCircle, Info, Settings } from "lucide-react"
import type { OperationType } from "@/lib/config-engine/allowlist"

export interface PreviewItem {
  idempotencyKey: string
  type: OperationType
  label: string
  title: string
  detail: string
}

export interface BatchPreviewData {
  batchId: string
  summary: string
  items: PreviewItem[]
  warnings: string[]
}

function OpIcon({ type }: { type: OperationType }) {
  switch (type) {
    case "CREATE_LOCATION":
    case "UPDATE_LOCATION":
      return <MapPin className="w-4 h-4 text-green-600" />
    case "CREATE_DEPARTMENT":
    case "UPDATE_DEPARTMENT":
      return <Building2 className="w-4 h-4 text-blue-600" />
    case "CREATE_ROUTING_RULE":
      return <ArrowRight className="w-4 h-4 text-purple-600" />
    default:
      return <Settings className="w-4 h-4 text-gray-500" />
  }
}

function opBg(type: OperationType): string {
  switch (type) {
    case "CREATE_LOCATION":
    case "UPDATE_LOCATION":
      return "bg-green-50 border-green-200"
    case "CREATE_DEPARTMENT":
    case "UPDATE_DEPARTMENT":
      return "bg-blue-50 border-blue-200"
    case "CREATE_ROUTING_RULE":
      return "bg-purple-50 border-purple-200"
    default:
      return "bg-gray-50 border-gray-200"
  }
}

interface OperationPreviewProps {
  preview: BatchPreviewData
  onApprove: () => void
  onDiscard: () => void
  applying: boolean
}

export function OperationPreview({ preview, onApprove, onDiscard, applying }: OperationPreviewProps) {
  const locationOps = preview.items.filter(i => i.type.includes("LOCATION"))
  const deptOps = preview.items.filter(i => i.type.includes("DEPARTMENT"))
  const ruleOps = preview.items.filter(i => i.type.includes("ROUTING"))
  const otherOps = preview.items.filter(i => !i.type.includes("LOCATION") && !i.type.includes("DEPARTMENT") && !i.type.includes("ROUTING"))

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">{preview.summary}</p>
          <p className="text-xs text-blue-700 mt-0.5">{preview.items.length} change{preview.items.length !== 1 ? "s" : ""} · Review and approve to apply</p>
        </div>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          {preview.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Operation groups */}
      {locationOps.length > 0 && (
        <OperationGroup label="Locations" items={locationOps} />
      )}
      {deptOps.length > 0 && (
        <OperationGroup label="Departments" items={deptOps} />
      )}
      {ruleOps.length > 0 && (
        <OperationGroup label="Routing Rules" items={ruleOps} />
      )}
      {otherOps.length > 0 && (
        <OperationGroup label="Other" items={otherOps} />
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onApprove}
          disabled={applying}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {applying ? (
            <><span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Applying…</>
          ) : (
            "Approve & Apply"
          )}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={applying}
          className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

function OperationGroup({ label, items }: { label: string; items: PreviewItem[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item.idempotencyKey}
            className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${opBg(item.type)}`}
          >
            <div className="mt-0.5 shrink-0">
              <OpIcon type={item.type} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-800">{item.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white border border-current opacity-60 font-medium"
                  style={{ fontSize: "10px" }}>
                  {item.label}
                </span>
              </div>
              {item.detail && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
