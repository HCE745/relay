"use client"
import { useState, useEffect, useRef } from "react"
import {
  Upload, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, Link, Loader2, FileText, Landmark, Download,
} from "lucide-react"

// ─── Status badge ─────────────────────────────────────────────────────────────

type Status = "connected" | "partial" | "coming_soon" | "not_connected" | "sandbox"

function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { label: string; cls: string }> = {
    connected:     { label: "Connected",      cls: "bg-green-100 text-green-700 border-green-200" },
    partial:       { label: "Partially Set Up", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    sandbox:       { label: "Sandbox Only",   cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    not_connected: { label: "Not Connected",  cls: "bg-gray-100 text-gray-500 border-gray-200" },
    coming_soon:   { label: "Coming Soon",    cls: "bg-purple-100 text-purple-700 border-purple-200" },
  }
  const { label, cls } = cfg[status]
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${cls}`}>{label}</span>
}

// ─── Integration card wrapper ─────────────────────────────────────────────────

function IntegrationCard({
  title, icon: Icon, status, description, children,
}: {
  title: string; icon: React.ElementType; status: Status
  description: string; children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-4 p-5 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>
      {open && children && <div className="border-t border-gray-100 p-5">{children}</div>}
    </div>
  )
}

// ─── CSV upload helper ────────────────────────────────────────────────────────

function CsvFileInput({ label, onLoad, accept = ".csv,.txt" }: { label: string; onLoad: (text: string, name: string) => void; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button onClick={() => ref.current?.click()}
          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
          <Upload className="w-4 h-4" /> Choose CSV file
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = (ev) => onLoad(ev.target?.result as string ?? "", file.name)
            reader.readAsText(file)
            e.target.value = ""
          }} />
      </div>
    </div>
  )
}

// ─── Hook stub (documented, not clickable) ────────────────────────────────────

function ApiHookStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Link className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API Integration Hook — Not Yet Connected</span>
      </div>
      <p className="text-xs font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── QuickBooks section ───────────────────────────────────────────────────────

function QBOSection({ entityId }: { entityId: string }) {
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<null | {
    toCreate: { name: string; rawType: string; type: string; code: string }[]
    skippedExisting: string[]
    skippedUnknownType: string[]
    errors: string[]
  }>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | { created: number; skippedExisting: number; errors: string[] }>(null)
  const [error, setError] = useState("")

  async function runPreview(text: string) {
    setLoading(true); setError(""); setPreview(null); setResult(null)
    try {
      const res = await fetch("/api/integrations/qbo/import-coa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text, entityId, preview: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPreview(json)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function commit() {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/integrations/qbo/import-coa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: csv, entityId, preview: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json); setPreview(null)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Import Chart of Accounts</h4>
        <p className="text-xs text-gray-500 mb-3">
          Export from QuickBooks Online: <strong>Accounting → Chart of Accounts → Export to CSV</strong>.
          Required columns: <code className="bg-gray-100 px-1 rounded">Account</code>, <code className="bg-gray-100 px-1 rounded">Type</code>.
          Existing accounts (same name) are skipped — no duplicates created.
        </p>
        <CsvFileInput label="QuickBooks Chart of Accounts CSV"
          onLoad={(text, name) => { setCsv(text); setFileName(name); runPreview(text) }} />
        {fileName && <p className="text-xs text-gray-400 mt-1">File: {fileName}</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</div>}

      {preview && (
        <div className="space-y-3">
          {preview.errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">Warnings ({preview.errors.length})</p>
              {preview.errors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
            </div>
          )}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              Preview: {preview.toCreate.length} accounts to import
              {preview.skippedExisting.length > 0 && `, ${preview.skippedExisting.length} already exist (skipped)`}
              {preview.skippedUnknownType.length > 0 && `, ${preview.skippedUnknownType.length} unknown type (skipped)`}
            </p>
          </div>
          {preview.toCreate.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left">Code (auto)</th>
                    <th className="py-2 px-3 text-left">Account Name</th>
                    <th className="py-2 px-3 text-left">QBO Type</th>
                    <th className="py-2 px-3 text-left">HCE Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.toCreate.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-3 font-mono text-gray-400">{r.code}</td>
                      <td className="py-1.5 px-3 font-medium">{r.name}</td>
                      <td className="py-1.5 px-3 text-gray-500">{r.rawType}</td>
                      <td className="py-1.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.type === "ASSET" ? "bg-blue-100 text-blue-700" : r.type === "LIABILITY" ? "bg-red-100 text-red-700" : r.type === "EQUITY" ? "bg-purple-100 text-purple-700" : r.type === "INCOME" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {r.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {preview.toCreate.length > 50 && (
                    <tr><td colSpan={4} className="py-2 px-3 text-gray-400 text-xs">… and {preview.toCreate.length - 50} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {preview.toCreate.length > 0 && (
            <button onClick={commit} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Import {preview.toCreate.length} Accounts
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-700">
            ✓ Imported {result.created} accounts
            {result.skippedExisting > 0 && ` · ${result.skippedExisting} already existed`}
          </p>
          {result.errors.length > 0 && result.errors.map((e, i) => <p key={i} className="text-xs text-amber-600 mt-1">{e}</p>)}
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Transaction Import — Not Yet Implemented</p>
        <p className="text-xs text-gray-500">
          QBO transaction CSV imports (register exports, general ledger exports) require
          mapping to double-entry journal format. This will be added in a future wave.
          The account import above is the prerequisite — run it first.
        </p>
      </div>

      <ApiHookStub
        title="QuickBooks Online API (OAuth 2.0) — Coming Soon"
        description="Future implementation: OAuth flow via Intuit Developer portal → access_token exchange → GET /v3/company/{realmId}/query for Accounts, JournalEntry, Vendor, Customer. Token stored encrypted per tenant. See /api/integrations/qbo/import-coa/route.ts for the type mapping that will be reused."
      />
    </div>
  )
}

// ─── Xero section ─────────────────────────────────────────────────────────────

function XeroSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-700">Coming Soon</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Xero CSV import and API integration are not yet implemented. The extension points below
            document the intended implementation.
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Planned CSV Import Format</h4>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-xs text-gray-600">
          <p className="text-gray-400 mb-1">{/* Xero Chart of Accounts export: Accounting → Chart of Accounts → Export */}</p>
          <p>Code,Name,Type,Tax Rate,Description,YTD Balance</p>
          <p>1100,Accounts Receivable,Current Asset,,Trade debtors,50000.00</p>
          <p>3000,Retained Earnings,Equity,,Retained earnings,...</p>
          <p>4000,Revenue,Revenue,GST,,...</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Xero&apos;s &quot;Type&quot; field maps to HCE Books account types. The same QBO type-mapping pattern
          will be reused with Xero-specific type strings.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Planned General Ledger Import Format</h4>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-xs text-gray-600">
          <p>Date,Source,ID,Name,Description,Reference,Net Amount,Account Code,Account Name,Account Type</p>
          <p>2024-01-15,INV,INV-0001,Acme Corp,Invoice payment,REF001,5000.00,1100,Accounts Receivable,Current Asset</p>
        </div>
      </div>

      <ApiHookStub
        title="Xero API (OAuth 2.0) — Coming Soon"
        description="Future implementation: OAuth 2.0 via Xero Identity platform (https://identity.xero.com/connect/authorize) → GET https://api.xero.com/api.xro/2.0/Accounts and /Journals. Xero uses a tenant-scoped xero-tenant-id header. Token stored encrypted per tenant (see lib/encrypt.ts). Same account type mapping as QBO but using Xero's Class field values."
      />
    </div>
  )
}

// ─── Bank Feed section ────────────────────────────────────────────────────────

function BankFeedSection({ entityId }: { entityId: string }) {
  const [status, setStatus] = useState<{
    accounts: { id: string; name: string; isLinked: boolean; lastSyncedAt: string | null; ledgerAccountId: string | null }[]
    plaidConfigured: boolean
    plaidEnv: string
    autoSyncReady: boolean
    autoSyncNote: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/integrations/bank-feed/status?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false))
  }, [entityId])

  return (
    <div className="space-y-4">
      {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading bank feed status…</div>}

      {status && (
        <>
          <div className={`flex items-start gap-3 p-3 rounded-xl border ${status.autoSyncReady ? "bg-green-50 border-green-200" : status.plaidConfigured ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
            {status.autoSyncReady ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
            <p className="text-xs text-gray-700">{status.autoSyncNote}</p>
          </div>

          {status.accounts.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Connected Bank Accounts</h4>
              <div className="space-y-2">
                {status.accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{a.name}</p>
                        <p className="text-xs text-gray-400">
                          {a.isLinked ? `Plaid linked · Last sync: ${a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString() : "never"}` : "Not linked to Plaid"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={a.isLinked ? (status.plaidConfigured ? "partial" : "sandbox") : "not_connected"} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No bank accounts connected for this entity. Use Banking → Connect Account to link via Plaid.</p>
          )}

          <div className="flex gap-3">
            <a href="/banking" className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              <Landmark className="w-4 h-4" /> Go to Banking
            </a>
          </div>

          <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Automatic Daily Sync — Not Yet Active</p>
            <p className="text-xs text-gray-500">
              Set <code className="bg-white px-1 rounded border border-gray-200">PLAID_ENV=production</code> and register the webhook at
              <code className="bg-white px-1 rounded border border-gray-200 mx-1">/api/banking/sync</code>
              in your Plaid dashboard to enable automatic daily transaction feeds.
              The sync route and Plaid client are already implemented in <code className="bg-white px-1 rounded border border-gray-200">src/lib/banking.ts</code>.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Payroll section ──────────────────────────────────────────────────────────

function PayrollSection({ entityId }: { entityId: string }) {
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<null | {
    entries: {
      date: string; description: string
      lines: { side: string; account: string; amountCents: number }[]
      grossWagesCents: number; netPayCents: number; taxWithheldCents: number; employerTaxesCents: number
      balanced: boolean
    }[]
    errors: string[]
    accountsDetected: {
      wagesAcct: { id: string; name: string; code: string } | null
      taxExpAcct: { id: string; name: string; code: string } | null
      cashAcct: { id: string; name: string; code: string } | null
      taxPayAcct: { id: string; name: string; code: string } | null
    }
  }>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | { created: number; errors: string[] }>(null)
  const [error, setError] = useState("")

  function fmtC(cents: number) { return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }) }

  const TEMPLATE_CSV = `Date,Description,GrossWages,TaxWithheld,EmployerTaxes,NetPay
2024-01-15,"Payroll Jan 1-15",5000.00,1032.50,382.50,3967.50
2024-01-31,"Payroll Jan 16-31",5000.00,1032.50,382.50,3967.50`

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }))
    const a = document.createElement("a"); a.href = url; a.download = "payroll-import-template.csv"; a.click()
  }

  async function runPreview(text: string) {
    setLoading(true); setError(""); setPreview(null); setResult(null)
    try {
      const res = await fetch("/api/integrations/payroll/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text, entityId, preview: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPreview(json)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function commit() {
    if (!preview) return
    setLoading(true); setError("")
    try {
      const body: Record<string, unknown> = { csvText: csv, entityId, preview: false }
      if (preview.accountsDetected.wagesAcct)  body.wagesAccountId = preview.accountsDetected.wagesAcct.id
      if (preview.accountsDetected.cashAcct)   body.cashAccountId  = preview.accountsDetected.cashAcct.id
      if (preview.accountsDetected.taxPayAcct) body.taxPayableAccountId = preview.accountsDetected.taxPayAcct.id
      if (preview.accountsDetected.taxExpAcct) body.taxExpenseAccountId = preview.accountsDetected.taxExpAcct.id

      const res = await fetch("/api/integrations/payroll/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json); setPreview(null)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const canCommit = preview && preview.entries.length > 0 &&
    preview.accountsDetected.wagesAcct && preview.accountsDetected.cashAcct && preview.accountsDetected.taxPayAcct

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Import Payroll Journal Summaries</h4>
        <p className="text-xs text-gray-500 mb-3">
          Import payroll run summaries as balanced journal entries. Each row becomes one journal entry:
          Wages Expense (debit) + Payroll Tax Expense (debit) = Cash/Net Pay (credit) + Tax Payable (credit).
          <strong className="ml-1">Requires an open accounting period for each payroll date.</strong>
        </p>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-xs text-gray-600 mb-3">
          <p className="text-gray-400 mb-1">Required CSV columns:</p>
          <p>Date, Description, GrossWages, TaxWithheld, EmployerTaxes, NetPay</p>
          <p className="text-gray-400 mt-1">Validation: GrossWages ≈ NetPay + TaxWithheld (within $1)</p>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <CsvFileInput label="Payroll CSV"
            onLoad={(text, name) => { setCsv(text); setFileName(name); runPreview(text) }} />
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs text-gray-500 rounded-lg hover:bg-gray-50 transition-colors mt-4">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
        </div>
        {fileName && <p className="text-xs text-gray-400">File: {fileName}</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</div>}

      {preview && (
        <div className="space-y-3">
          {/* Account detection */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-2">Account Mappings (auto-detected)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Wages Expense (DEBIT)", acct: preview.accountsDetected.wagesAcct },
                { label: "Payroll Tax Expense (DEBIT)", acct: preview.accountsDetected.taxExpAcct },
                { label: "Cash / Net Pay (CREDIT)", acct: preview.accountsDetected.cashAcct },
                { label: "Payroll Tax Payable (CREDIT)", acct: preview.accountsDetected.taxPayAcct },
              ].map(({ label, acct }) => (
                <div key={label} className={`p-2 rounded border text-xs ${acct ? "bg-white border-blue-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-gray-400">{label}</p>
                  {acct ? <p className="font-medium text-gray-700">{acct.code} — {acct.name}</p>
                         : <p className="text-red-600 font-medium">⚠ Not found — import may fail</p>}
                </div>
              ))}
            </div>
            {!canCommit && <p className="text-xs text-red-600 mt-2">Missing one or more required accounts. Create the accounts first (or import your Chart of Accounts above), then retry.</p>}
          </div>

          {preview.errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">Warnings / Errors</p>
              {preview.errors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
            </div>
          )}

          {preview.entries.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Gross Wages</th>
                    <th className="py-2 px-3 text-right">Tax Withheld</th>
                    <th className="py-2 px-3 text-right">Empl. Taxes</th>
                    <th className="py-2 px-3 text-right">Net Pay</th>
                    <th className="py-2 px-3 text-center">Balanced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-3 font-mono text-gray-500">{e.date}</td>
                      <td className="py-1.5 px-3">{e.description}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{fmtC(e.grossWagesCents)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{fmtC(e.taxWithheldCents)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{fmtC(e.employerTaxesCents)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{fmtC(e.netPayCents)}</td>
                      <td className="py-1.5 px-3 text-center">{e.balanced ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCommit && (
            <button onClick={commit} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Post {preview.entries.length} Payroll Journal Entr{preview.entries.length === 1 ? "y" : "ies"}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-700">✓ Posted {result.created} journal entries</p>
          {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-600 mt-1">{e}</p>)}
        </div>
      )}

      <ApiHookStub
        title="Payroll Provider API Integration — Coming Soon"
        description="Future implementation: connect Gusto, ADP, or Paychex via their OAuth/API key flows. Each payroll run's summary (gross wages, taxes, net pay) maps to the same 4-line journal structure used by this CSV import. See /api/integrations/payroll/import/route.ts — the createAndPostEntry() call and journal structure are reusable."
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// QuickBooks logo SVG inline (trademark of Intuit — used for UI identification only)
function QBOIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-5 h-5">
      <rect width="40" height="40" rx="8" fill="#2CA01C" />
      <text x="20" y="27" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold" fontFamily="Arial">Q</text>
    </svg>
  )
}
function XeroIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-5 h-5">
      <rect width="40" height="40" rx="8" fill="#13B5EA" />
      <text x="20" y="27" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">x</text>
    </svg>
  )
}
function PlaidIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-5 h-5">
      <rect width="40" height="40" rx="8" fill="#111827" />
      <text x="20" y="27" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">P</text>
    </svg>
  )
}

export function IntegrationsPage({ entityId, isConsolidationParent: _ }: { entityId: string; isConsolidationParent: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
        <p>These integrations show their real connection status. <strong>Nothing is faked.</strong> Sections marked "Coming Soon" are stubs with documented extension points for future implementation.</p>
      </div>

      <IntegrationCard
        title="QuickBooks Online"
        icon={QBOIcon}
        status="partial"
        description="Import Chart of Accounts from QBO CSV export. Transaction import and OAuth API coming soon."
      >
        <QBOSection entityId={entityId} />
      </IntegrationCard>

      <IntegrationCard
        title="Xero"
        icon={XeroIcon}
        status="coming_soon"
        description="Xero CSV import and API integration. Extension points documented — not yet implemented."
      >
        <XeroSection />
      </IntegrationCard>

      <IntegrationCard
        title="Bank Feed (Plaid)"
        icon={PlaidIcon}
        status="sandbox"
        description="Plaid Link integration for bank account feeds. Sandbox configured; production requires PLAID_ENV=production."
      >
        <BankFeedSection entityId={entityId} />
      </IntegrationCard>

      <IntegrationCard
        title="Payroll Import"
        icon={FileText}
        status="partial"
        description="Import payroll journal summaries from CSV. Posts balanced journal entries via the ledger. Payroll provider API hooks documented."
      >
        <PayrollSection entityId={entityId} />
      </IntegrationCard>
    </div>
  )
}
