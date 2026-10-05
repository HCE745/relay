"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, CheckCircle, DollarSign, XCircle, ChevronDown, ChevronRight, Plus } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

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
  attributionId: string;
};

type Attribution = {
  id: string;
  commissionRate: string;
  attributionStatus: string;
  attributionReason: string;
  isLocked: boolean;
  commissionOwnerId: string;
  notes: string | null;
  opportunity: { id: string; title: string; closedAt: string | null; value: string | null };
  commissionOwner: { id: string; name: string };
  payments: Payment[];
};

type RepSummary = {
  rep: { id: string; name: string; email: string; role: string; employmentStatus: string; commissionEligible: boolean; commissionRate: number };
  activeAccountCount: number;
  totalMrr: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  attributions: Attribution[];
};

type Totals = { totalGrossRevenue: number; totalCommissionDue: number; totalCommissionPaid: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID:     "bg-green-100 text-green-800",
  VOIDED:   "bg-gray-100 text-gray-400",
};

// ── Payment Actions ──────────────────────────────────────────────────────────

function PaymentRow({ p, onRefresh }: { p: Payment; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [paidAt, setPaidAt]   = useState("");

  async function act(action: string, extra?: Record<string, string>) {
    setLoading(true);
    await fetch(`/api/sales/commission/payments/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setLoading(false);
    onRefresh();
  }

  return (
    <tr className="hover:bg-gray-50 text-sm">
      <td className="px-4 py-2 text-gray-500">
        {p.periodStart ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : fmtDate(p.paymentReceivedAt)}
      </td>
      <td className="px-4 py-2 text-right font-mono">{fmt(Number(p.grossRevenue))}</td>
      <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(Number(p.commissionAmount))}</td>
      <td className="px-4 py-2 text-right">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.commissionStatus] ?? ""}`}>
          {p.commissionStatus}
        </span>
      </td>
      <td className="px-4 py-2 text-right text-gray-500">{fmtDate(p.commissionPaidAt)}</td>
      <td className="px-4 py-2 text-right">
        {p.commissionStatus === "PENDING" && (
          <button
            onClick={() => act("approve")}
            disabled={loading}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {p.commissionStatus === "APPROVED" && (
          <div className="flex items-center gap-1 justify-end">
            <input
              type="date"
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
              className="text-xs border rounded px-1 py-0.5 w-28"
            />
            <button
              onClick={() => act("pay", paidAt ? { paidAt } : {})}
              disabled={loading}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Mark Paid
            </button>
          </div>
        )}
        {["PENDING","APPROVED"].includes(p.commissionStatus) && (
          <button
            onClick={() => act("void")}
            disabled={loading}
            className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 ml-1"
          >
            Void
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Manual Attribution Modal ─────────────────────────────────────────────────

function ManualAttributionModal({
  opportunityId,
  reps,
  onClose,
  onSave,
}: {
  opportunityId: string;
  reps: RepSummary[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [ownerId, setOwnerId]   = useState("");
  const [reason, setReason]     = useState("MANUAL_EXCEPTION");
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function save() {
    if (!ownerId || !notes) { setError("Owner and notes are required."); return; }
    setLoading(true);
    const res = await fetch(`/api/sales/commission/attributions/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionOwnerId: ownerId, attributionReason: reason, notes, attributionStatus: "APPROVED" }),
    });
    setLoading(false);
    if (res.ok) { onSave(); onClose(); }
    else setError("Failed to save attribution.");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Manual Attribution Exception</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Commission Owner</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select rep…</option>
              {reps.map(r => <option key={r.rep.id} value={r.rep.id}>{r.rep.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="MANUAL_EXCEPTION">Manual Exception</option>
              <option value="FOUNDER_REFERRAL">Founder Referral</option>
              <option value="REASSIGNMENT">Reassignment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (required)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Explain why this exception is being made…"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Saving…" : "Save Attribution"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CommissionLedgerPage() {
  const [data, setData]         = useState<{ repSummaries: RepSummary[]; totals: Totals } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [manualOppId, setManualOppId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sales/manager/commissions")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    window.open("/api/sales/manager/commissions?export=csv", "_blank");
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { repSummaries = [], totals } = data ?? {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {manualOppId && (
        <ManualAttributionModal
          opportunityId={manualOppId}
          reps={repSummaries}
          onClose={() => setManualOppId(null)}
          onSave={load}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">All rep commissions — approve, pay, and export for accounting.</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Company totals */}
      {totals && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Gross Revenue",      value: totals.totalGrossRevenue,     icon: DollarSign,  color: "text-gray-900" },
            { label: "Commission Liability",     value: totals.totalCommissionDue,    icon: CheckCircle, color: "text-amber-600" },
            { label: "Commission Paid",          value: totals.totalCommissionPaid,   icon: DollarSign,  color: "text-green-600" },
          ].map(c => (
            <div key={c.label} className="rounded-xl border bg-white p-5">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs text-gray-500 font-medium">{c.label}</span>
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{fmt(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-rep rows */}
      <div className="space-y-3">
        {repSummaries.map(r => {
          const isOpen = expanded[r.rep.id];
          const allPayments = r.attributions.flatMap(a => a.payments);
          return (
            <div key={r.rep.id} className="rounded-xl border bg-white overflow-hidden">
              {/* Rep header */}
              <button
                onClick={() => setExpanded(e => ({ ...e, [r.rep.id]: !isOpen }))}
                className="w-full flex items-center px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{r.rep.name}</p>
                    <span className="text-xs text-gray-400">{r.rep.role === "admin_sales" ? "Manager" : "Rep"}</span>
                    {r.rep.employmentStatus === "INACTIVE" && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{r.rep.email} · {r.rep.commissionRate}% rate</p>
                </div>
                <div className="grid grid-cols-4 gap-6 text-right ml-4 shrink-0">
                  <div>
                    <p className="text-xs text-gray-400">Accounts</p>
                    <p className="font-semibold">{r.activeAccountCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600">Pending</p>
                    <p className="font-semibold text-amber-700">{fmt(r.pendingCommission)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Approved</p>
                    <p className="font-semibold text-blue-700">{fmt(r.approvedCommission)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600">Paid</p>
                    <p className="font-semibold text-green-700">{fmt(r.paidCommission)}</p>
                  </div>
                </div>
                <div className="ml-4 text-gray-400">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>

              {/* Expanded: per-attribution payment tables */}
              {isOpen && (
                <div className="border-t divide-y">
                  {r.attributions.length === 0 && (
                    <p className="px-5 py-3 text-sm text-gray-400">No attributions.</p>
                  )}
                  {r.attributions.map(a => (
                    <div key={a.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{a.opportunity.title}</p>
                          <p className="text-xs text-gray-400">
                            Closed {fmtDate(a.opportunity.closedAt)} ·{" "}
                            <span className={
                              a.attributionReason !== "NORMAL_CLOSE" ? "text-amber-600 font-medium" : ""
                            }>
                              {a.attributionReason.replace(/_/g, " ")}
                            </span>
                            {" · "}
                            <span>{a.attributionStatus}</span>
                            {a.isLocked && " · 🔒 Locked"}
                          </p>
                        </div>
                        <button
                          onClick={() => setManualOppId(a.id)}
                          className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-gray-50"
                        >
                          <Plus className="w-3 h-3" /> Manual Attribution
                        </button>
                      </div>
                      {a.payments.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b">
                              <th className="text-left px-4 py-1.5 font-medium">Period</th>
                              <th className="text-right px-4 py-1.5 font-medium">Revenue</th>
                              <th className="text-right px-4 py-1.5 font-medium">Commission</th>
                              <th className="text-right px-4 py-1.5 font-medium">Status</th>
                              <th className="text-right px-4 py-1.5 font-medium">Paid Date</th>
                              <th className="text-right px-4 py-1.5 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {a.payments.map(p => (
                              <PaymentRow key={p.id} p={p} onRefresh={load} />
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-gray-400">No payments yet — generated when Stripe invoices arrive.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {repSummaries.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <XCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No sales reps or commission data yet.</p>
        </div>
      )}
    </div>
  );
}
