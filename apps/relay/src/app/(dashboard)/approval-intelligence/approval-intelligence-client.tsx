"use client"

import { useState } from "react"
import {
  CheckSquare, Package, Shield, Clock, TrendingUp, Sparkles,
  AlertTriangle, BarChart2, CheckCircle, Settings,
} from "lucide-react"
import Link from "next/link"

interface Summary {
  total: number; autoApproved: number; approved: number; rejected: number
  pending: number; autoRate: number; catalogCount: number; policyCount: number
  avgConfidence: number | null; estimatedHoursSaved: number
}

interface CategoryStat {
  category: string; count: number; autoApproved: number; spend: number
}

interface Props {
  orgEnabled: boolean
  orgId: string
  summary: Summary
  byCategory: CategoryStat[]
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SetupBanner({ catalogCount, policyCount }: { catalogCount: number; policyCount: number }) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-indigo-900 mb-1">Approval Intelligence is Active</h2>
          <p className="text-sm text-indigo-700 mb-4">
            AI identifies requested items, matches them to your catalog, evaluates approval policies, and routes requests automatically. The company defines all policies — Relay executes them.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/approval-intelligence/catalog" className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              <Package className="w-4 h-4" />
              {catalogCount === 0 ? "Set Up Item Catalog" : `Manage Catalog (${catalogCount})`}
            </Link>
            <Link href="/approval-intelligence/policies" className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50">
              <Shield className="w-4 h-4" />
              {policyCount === 0 ? "Create Approval Policy" : `Manage Policies (${policyCount})`}
            </Link>
            <Link href="/purchase-requests" className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50">
              <CheckSquare className="w-4 h-4" />
              View Requests
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function SetupGuide({ catalogCount, policyCount }: { catalogCount: number; policyCount: number }) {
  const steps = [
    {
      done: catalogCount > 0,
      label: "Add items to the Approved Item Catalog",
      desc: "The catalog defines what your organization buys. AI matches requests against it.",
      href: "/approval-intelligence/catalog",
      cta: "Go to Catalog",
    },
    {
      done: policyCount > 0,
      label: "Configure an Approval Policy",
      desc: "Define dollar thresholds, category rules, and which role must approve each type of request.",
      href: "/approval-intelligence/policies",
      cta: "Create Policy",
    },
    {
      done: false,
      label: "Enable Approval Intelligence in Settings",
      desc: "Turn on the module for your organization so employees can start submitting requests.",
      href: "/settings",
      cta: "Go to Settings",
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Getting Started</h2>
      <p className="text-sm text-gray-500 mb-4">Complete these steps to enable Approval Intelligence for your organization.</p>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.done ? "bg-green-100" : "bg-gray-100"}`}>
              {step.done
                ? <CheckCircle className="w-4 h-4 text-green-600" />
                : <span className="text-xs font-bold text-gray-400">{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{step.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
            </div>
            {!step.done && (
              <Link href={step.href} className="text-xs text-indigo-600 hover:underline font-medium flex-shrink-0">{step.cta} →</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApprovalIntelligenceClient({ orgEnabled, summary, byCategory }: Props) {
  const [_tab, setTab] = useState("overview")

  const hasData = summary.total > 0

  return (
    <div className="max-w-6xl mx-auto">
      {/* Nav tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {["overview", "analytics"].map(tab => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              _tab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "overview" ? "Overview" : "Analytics"}
          </button>
        ))}
        <Link href="/approval-intelligence/catalog" className="px-4 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700">Catalog</Link>
        <Link href="/approval-intelligence/policies" className="px-4 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700">Policies</Link>
      </div>

      {/* Setup guide if not enabled */}
      {!orgEnabled && <SetupGuide catalogCount={summary.catalogCount} policyCount={summary.policyCount} />}

      {/* Active banner */}
      {orgEnabled && <SetupBanner catalogCount={summary.catalogCount} policyCount={summary.policyCount} />}

      {/* Pending alert */}
      {summary.pending > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{summary.pending} request{summary.pending !== 1 ? "s" : ""} awaiting approval</p>
            <p className="text-xs text-amber-700">Review and act on these to keep the queue moving.</p>
          </div>
          <Link href="/purchase-requests" className="text-xs font-medium text-amber-800 hover:text-amber-900 underline">
            View Requests →
          </Link>
        </div>
      )}

      {_tab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Requests" value={summary.total} icon={CheckSquare} color="bg-gray-100 text-gray-600" />
            <StatCard label="Auto-Approved" value={summary.autoApproved} sub={`${summary.autoRate}% auto-approval rate`} icon={Sparkles} color="bg-green-100 text-green-700" />
            <StatCard label="Hours Saved" value={summary.estimatedHoursSaved.toFixed(1)} sub="estimated management hours" icon={Clock} color="bg-blue-100 text-blue-700" />
            <StatCard label="AI Confidence" value={summary.avgConfidence != null ? `${summary.avgConfidence}%` : "—"} sub="average match confidence" icon={TrendingUp} color="bg-indigo-100 text-indigo-700" />
          </div>

          {/* Setup status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link href="/approval-intelligence/catalog" className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <Package className="w-5 h-5 text-indigo-600 mb-2" />
              <p className="text-lg font-bold text-gray-900">{summary.catalogCount}</p>
              <p className="text-xs text-gray-500">Catalog Items</p>
            </Link>
            <Link href="/approval-intelligence/policies" className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <Shield className="w-5 h-5 text-indigo-600 mb-2" />
              <p className="text-lg font-bold text-gray-900">{summary.policyCount}</p>
              <p className="text-xs text-gray-500">Approval Policies</p>
            </Link>
            <Link href="/purchase-requests?status=AWAITING_APPROVAL" className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-amber-300 hover:bg-amber-50 transition-colors">
              <Clock className="w-5 h-5 text-amber-600 mb-2" />
              <p className="text-lg font-bold text-gray-900">{summary.pending}</p>
              <p className="text-xs text-gray-500">Pending Approval</p>
            </Link>
            <Link href="/settings" className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-colors">
              <Settings className="w-5 h-5 text-gray-500 mb-2" />
              <p className="text-sm font-semibold text-gray-900">Settings</p>
              <p className="text-xs text-gray-500">Configure module</p>
            </Link>
          </div>

          {/* Request status breakdown */}
          {hasData && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Request Status Breakdown</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  {[
                    { count: summary.autoApproved, color: "bg-green-400" },
                    { count: summary.approved,     color: "bg-emerald-500" },
                    { count: summary.rejected,     color: "bg-red-400" },
                    { count: summary.pending,      color: "bg-amber-400" },
                  ].map((seg, i) => (
                    <div key={i} className={`h-full ${seg.color}`} style={{ width: `${summary.total > 0 ? (seg.count / summary.total) * 100 : 0}%` }} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Auto-Approved", count: summary.autoApproved, color: "bg-green-100 text-green-700" },
                  { label: "Manually Approved", count: summary.approved, color: "bg-emerald-100 text-emerald-700" },
                  { label: "Rejected", count: summary.rejected, color: "bg-red-100 text-red-700" },
                  { label: "Pending", count: summary.pending, color: "bg-amber-100 text-amber-700" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`inline-block text-sm font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {_tab === "analytics" && (
        <div className="space-y-6">
          {!hasData && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No data yet</p>
              <p className="text-xs mt-1">Analytics will populate as purchase requests are submitted and approved.</p>
            </div>
          )}

          {hasData && (
            <>
              {/* Approval savings */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" /> Approval Savings Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.autoRate}%</p>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-Approval Rate</p>
                    <p className="text-xs text-gray-400 mt-1">{summary.autoApproved} of {summary.total} requests required no manual review</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.estimatedHoursSaved.toFixed(1)}h</p>
                    <p className="text-xs text-gray-500 mt-0.5">Management Hours Saved</p>
                    <p className="text-xs text-gray-400 mt-1">Based on ~30 min per manual review avoided</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.avgConfidence != null ? `${summary.avgConfidence}%` : "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Average AI Confidence</p>
                    <p className="text-xs text-gray-400 mt-1">Higher confidence = more reliable catalog matches</p>
                  </div>
                </div>
              </div>

              {/* By category */}
              {byCategory.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-600" /> By Category
                  </h3>
                  <div className="space-y-3">
                    {byCategory.sort((a, b) => b.count - a.count).map(cat => (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium">{cat.category}</span>
                          <span className="text-gray-500">{cat.count} requests · ${cat.spend.toFixed(0)} total</span>
                        </div>
                        <div className="flex h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="bg-green-400 h-full"
                            style={{ width: `${cat.count > 0 ? (cat.autoApproved / cat.count) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-indigo-200 h-full"
                            style={{ width: `${cat.count > 0 ? ((cat.count - cat.autoApproved) / cat.count) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
                          <span className="text-green-600">{cat.autoApproved} auto-approved</span>
                          <span>{cat.count - cat.autoApproved} manual</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI performance */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> AI Performance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.autoApproved}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-Approved</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.approved}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Human-Approved</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.avgConfidence != null ? `${summary.avgConfidence}%` : "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Avg. Confidence</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.total > 0 ? `${summary.autoRate}%` : "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Auto Rate</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  AI performance improves as catalog items are added and purchase history grows. Review and accept AI policy recommendations to continuously improve automation rates.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
