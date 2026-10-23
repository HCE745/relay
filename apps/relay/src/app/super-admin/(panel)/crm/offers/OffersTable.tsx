"use client"

import { useState } from "react"
import { Copy, CheckCircle2, Clock, Tag, AlertTriangle } from "lucide-react"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

const PLAN_LABELS: Record<string, string> = {
  essentials:        "Essentials",
  professional:      "Professional",
  professional_plus: "Professional Plus",
  wash_essentials:   "Wash Essentials",
}

type Offer = {
  id: string
  token: string
  offerType: string
  discountPercent: number | null
  flatMonthlyPrice: number | null
  freeMonths: number | null
  durationMonths: number | null
  targetPlan: string
  maxRedemptions: number
  redemptionCount: number
  expiresAt: string | Date | null
  redeemedAt: string | Date | null
  notes: string | null
  createdAt: string | Date
  createdBySalesUser: { name: string; email: string } | null
  createdBySA: { name: string } | null
  opportunity: { id: string; title: string } | null
  redeemedByOrg: { id: string; name: string } | null
}

function describeOffer(o: Offer): string {
  if (o.offerType === "PERCENT_DISCOUNT") {
    const dur = o.durationMonths ? ` for ${o.durationMonths} mo` : ""
    return `${o.discountPercent}% off${dur}`
  }
  if (o.offerType === "FLAT_PRICE") return `$${o.flatMonthlyPrice}/mo flat`
  if (o.offerType === "FREE_MONTHS") return `${o.freeMonths} free month${o.freeMonths !== 1 ? "s" : ""}`
  return o.offerType
}

function offerStatus(o: Offer): { label: string; color: string } {
  if (o.redeemedAt) return { label: "Redeemed", color: "bg-green-900/40 text-green-300" }
  const now = new Date()
  if (o.expiresAt && new Date(o.expiresAt) < now) return { label: "Expired", color: "bg-gray-800 text-gray-500" }
  if (o.redemptionCount >= o.maxRedemptions) return { label: "Exhausted", color: "bg-gray-800 text-gray-500" }
  return { label: "Active", color: "bg-emerald-900/40 text-emerald-300" }
}

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${APP_URL}/register?offer=${token}`

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}

export function OffersTable({ offers }: { offers: Offer[] }) {
  const [filter, setFilter] = useState<"all" | "active" | "redeemed" | "expired">("all")

  const filtered = offers.filter(o => {
    const status = offerStatus(o).label.toLowerCase()
    if (filter === "active") return status === "active"
    if (filter === "redeemed") return status === "redeemed"
    if (filter === "expired") return status === "expired" || status === "exhausted"
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "redeemed", "expired"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} offers</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No offers found</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Offer</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Created by</th>
                  <th className="text-left px-4 py-3 font-medium">Opportunity</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Redeemed by</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-left px-4 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map(o => {
                  const status = offerStatus(o)
                  return (
                    <tr key={o.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{describeOffer(o)}</p>
                        <p className="text-xs text-gray-600 font-mono mt-0.5">{o.token}</p>
                        {o.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 max-w-48 truncate">{o.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {PLAN_LABELS[o.targetPlan] ?? o.targetPlan}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {o.createdBySalesUser
                          ? <span className="flex items-center gap-1"><Tag className="w-3 h-3 text-blue-400" />{o.createdBySalesUser.name}</span>
                          : o.createdBySA
                          ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-purple-400" />{o.createdBySA.name}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {o.opportunity ? o.opportunity.title : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        {o.maxRedemptions > 1 && (
                          <p className="text-xs text-gray-600 mt-0.5">{o.redemptionCount}/{o.maxRedemptions}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {o.redeemedByOrg
                          ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{o.redeemedByOrg.name}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {o.expiresAt
                          ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(o.expiresAt).toLocaleDateString()}</span>
                          : <span className="text-gray-600">Never</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {status.label === "Active" && <CopyButton token={o.token} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
