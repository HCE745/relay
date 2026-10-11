"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Batch = { id: string; filename: string | null; customersCreated: number; sitesCreated: number; contactsCreated: number; createdAt: string; rolledBackAt: string | null }
type PreviewRow = { line: number; customer: string; site: string; contact: string; status: "create" | "duplicate" | "error"; errors: string[] }
type Preview = { headerError: string | null; errorCount: number; rows: PreviewRow[]; summary: { customersToCreate: number; sitesToCreate: number; contactsToCreate: number; duplicates: number; errors: number } }

const TONE: Record<string, BadgeTone> = { create: "success", duplicate: "warning", error: "danger" }

export function ImportClient({ batches, latestId }: { batches: Batch[]; latestId: string | null }) {
  const router = useRouter()
  const [csv, setCsv] = useState("")
  const [filename, setFilename] = useState<string | undefined>(undefined)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setFilename(f.name); setCsv(await f.text()); setPreview(null); setDone(null); setError(null)
  }
  async function doPreview() {
    setBusy(true); setError(null); setDone(null)
    const res = await apiSend<Preview>("/api/import/customers/preview", "POST", { csv })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setPreview(res.data)
  }
  async function doCommit() {
    setBusy(true); setError(null)
    const res = await apiSend<{ customersCreated: number; sitesCreated: number; contactsCreated: number }>("/api/import/customers/commit", "POST", { csv, filename })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(`Imported ${res.data.customersCreated} customers, ${res.data.sitesCreated} sites, ${res.data.contactsCreated} contacts.`)
    setCsv(""); setPreview(null); router.refresh()
  }
  async function rollback(id: string) {
    setBusy(true); setError(null)
    const res = await apiSend("/api/import/batches/" + id + "/rollback", "POST")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  const canCommit = preview && !preview.headerError && preview.errorCount === 0 && preview.summary.customersToCreate > 0

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Upload a CSV</h2>
            <p className="text-xs text-slate-400">Customers, their sites and a contact — one row per site.</p>
          </div>
          <a href="/api/import/customers/template" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Download template</a>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-3 block text-sm" />
        <div className="mt-3 flex gap-2">
          <Button onClick={doPreview} disabled={busy || !csv} variant="secondary">Preview</Button>
          <Button onClick={doCommit} disabled={busy || !canCommit}>Import{preview ? ` ${preview.summary.customersToCreate}` : ""}</Button>
        </div>
        {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {done ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p> : null}
      </Card>

      {preview ? (
        <Card className="p-5">
          {preview.headerError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{preview.headerError}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-3 text-sm">
                <span className="text-emerald-700">{preview.summary.customersToCreate} customers</span>
                <span className="text-slate-500">{preview.summary.sitesToCreate} sites</span>
                <span className="text-slate-500">{preview.summary.contactsToCreate} contacts</span>
                <span className="text-amber-600">{preview.summary.duplicates} duplicates (skipped)</span>
                <span className={preview.summary.errors ? "font-semibold text-red-700" : "text-slate-400"}>{preview.summary.errors} errors</span>
              </div>
              {preview.errorCount > 0 ? <p className="mb-2 text-xs text-red-600">Fix the errors and re-preview — the import is all-or-nothing.</p> : null}
              <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2 text-left">Line</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Site</th><th className="px-3 py-2 text-left">Contact</th><th className="px-3 py-2 text-left">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-2 text-slate-400">{r.line}</td>
                        <td className="px-3 py-2 text-slate-800">{r.customer}</td>
                        <td className="px-3 py-2 text-slate-500">{r.site || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.contact || "—"}</td>
                        <td className="px-3 py-2"><StatusBadge tone={TONE[r.status]}>{r.status}</StatusBadge>{r.errors.length ? <span className="ml-2 text-xs text-red-600">{r.errors.join("; ")}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Import history</h2>
        {batches.length === 0 ? <p className="text-sm text-slate-500">No imports yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{b.filename ?? "Import"}</span>
                  <span className="ml-2 text-slate-500">{b.customersCreated} customers · {b.sitesCreated} sites · {b.contactsCreated} contacts</span>
                  <span className="ml-2 text-xs text-slate-400">{new Date(b.createdAt).toLocaleString()}</span>
                </div>
                {b.rolledBackAt ? <StatusBadge tone="neutral">Rolled back</StatusBadge> : b.id === latestId ? <Button size="sm" variant="ghost" onClick={() => rollback(b.id)} disabled={busy}>Roll back</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
