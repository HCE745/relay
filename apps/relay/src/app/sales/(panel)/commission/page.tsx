"use client";

import { useEffect, useState } from "react";
import { DollarSign, Clock, CheckCircle, TrendingUp, Lock, AlertCircle } from "lucide-react";

type Payment = {
  id: string;
  commissionStatus: string;
  commissionAmount: string;
  commissionRate: string;
  grossRevenue: string;
  paymentReceivedAt: string;
  commissionPaidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
};

type Attribution = {
  id: string;
  commissionRate: string;
  attributionStatus: string;
  attributionReason: string;
  isLocked: boolean;
  attributionLockedAt: string | null;
  notes: string | null;
  opportunity: {
    id: string;
    title: string;
    closedAt: string | null;
    value: string | null;
    customerOrganizationId: string | null;
  };
  commissionOwner: { id: string; name: string };
  payments: Payment[];
};

type Summary = {
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  lifetimeEarned: number;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID:     "bg-green-100 text-green-800",
  VOIDED:   "bg-gray-100 text-gray-500",
};

const ATTRIBUTION_COLORS: Record<string, string> = {
  PENDING:  "text-amber-600",
  APPROVED: "text-blue-600",
  DISPUTED: "text-red-600",
  REVOKED:  "text-gray-400",
};

const REASON_LABELS: Record<string, string> = {
  NORMAL_CLOSE:      "Normal Close",
  MANUAL_EXCEPTION:  "Manual Exception",
  REASSIGNMENT:      "Reassignment",
  FOUNDER_REFERRAL:  "Founder Referral",
};

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CommissionPage() {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/sales/commission")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { attributions: Attribution[]; summary: Summary }) => {
        setAttributions(d.attributions);
        setSummary(d.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const allPayments = attributions.flatMap(a => a.payments);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Commission</h1>
        <p className="text-sm text-gray-500 mt-1">Commission attributions and payment history for your closed deals.</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending",         value: summary.pendingAmount,  icon: Clock,      color: "text-amber-600",  bg: "bg-amber-50" },
            { label: "Approved",        value: summary.approvedAmount, icon: CheckCircle,color: "text-blue-600",   bg: "bg-blue-50" },
            { label: "Paid",            value: summary.paidAmount,     icon: DollarSign, color: "text-green-600",  bg: "bg-green-50" },
            { label: "Lifetime Earned", value: summary.lifetimeEarned, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs font-medium text-gray-600">{c.label}</span>
              </div>
              <p className={`text-xl font-bold ${c.color}`}>{fmt(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* My Accounts */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">My Accounts</h2>
        {attributions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-gray-400 text-sm">
            No commission attributions yet. Close a deal to see it here.
          </div>
        ) : (
          <div className="space-y-3">
            {attributions.map(a => {
              const isOpen = expanded[a.id];
              const totalPaid = a.payments.filter(p => p.commissionStatus === "PAID")
                .reduce((s, p) => s + Number(p.commissionAmount), 0);
              return (
                <div key={a.id} className="rounded-xl border bg-white overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [a.id]: !isOpen }))}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {a.isLocked && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{a.opportunity.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Closed {fmtDate(a.opportunity.closedAt)} · {Number(a.commissionRate).toFixed(0)}% rate
                          {a.attributionReason !== "NORMAL_CLOSE" && (
                            <span className="ml-2 text-amber-600">({REASON_LABELS[a.attributionReason] ?? a.attributionReason})</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`text-xs font-medium ${ATTRIBUTION_COLORS[a.attributionStatus] ?? "text-gray-500"}`}>
                        {a.attributionStatus}
                      </span>
                      {totalPaid > 0 && (
                        <span className="text-sm font-semibold text-green-600">{fmt(totalPaid)} paid</span>
                      )}
                      <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t px-5 py-4 bg-gray-50">
                      {a.payments.length === 0 ? (
                        <p className="text-sm text-gray-400">No payments generated yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b">
                              <th className="text-left pb-2 font-medium">Period</th>
                              <th className="text-right pb-2 font-medium">Revenue</th>
                              <th className="text-right pb-2 font-medium">Commission</th>
                              <th className="text-right pb-2 font-medium">Status</th>
                              <th className="text-right pb-2 font-medium">Paid Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {a.payments.map(p => (
                              <tr key={p.id}>
                                <td className="py-2 text-gray-600">
                                  {p.periodStart
                                    ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`
                                    : fmtDate(p.paymentReceivedAt)}
                                </td>
                                <td className="py-2 text-right font-mono text-gray-900">{fmt(Number(p.grossRevenue))}</td>
                                <td className="py-2 text-right font-mono font-semibold text-gray-900">{fmt(Number(p.commissionAmount))}</td>
                                <td className="py-2 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.commissionStatus] ?? ""}`}>
                                    {p.commissionStatus}
                                  </span>
                                </td>
                                <td className="py-2 text-right text-gray-500">{fmtDate(p.commissionPaidAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      {allPayments.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Commission History</h2>
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Period</th>
                  <th className="text-right px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allPayments
                  .slice()
                  .sort((a, b) => new Date(b.paymentReceivedAt).getTime() - new Date(a.paymentReceivedAt).getTime())
                  .map(p => {
                    const attr = attributions.find(a => a.payments.some(pp => pp.id === p.id));
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{attr?.opportunity.title ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(Number(p.commissionAmount))}</td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {p.periodStart ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : fmtDate(p.paymentReceivedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.commissionStatus] ?? ""}`}>
                            {p.commissionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmtDate(p.commissionPaidAt)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allPayments.length === 0 && attributions.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No commission data yet.</p>
        </div>
      )}
    </div>
  );
}
