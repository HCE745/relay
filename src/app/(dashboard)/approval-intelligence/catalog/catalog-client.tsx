"use client"

import { useState, useRef } from "react"
import {
  Plus, Search, Package, Edit2, Trash2, Upload, Download,
  ChevronDown, ChevronUp, ExternalLink, Tag, DollarSign,
  CheckCircle, XCircle, AlertCircle,
} from "lucide-react"
import Link from "next/link"

interface Vendor  { id: string; name: string }
interface Policy  { id: string; name: string }
interface CatalogItem {
  id: string; name: string; category: string; description: string | null
  vendorSku: string | null; manufacturer: string | null; modelNumber: string | null
  estimatedCost: number | null; replacementUrl: string | null
  autoApproveBelow: number | null; notes: string | null; isActive: boolean
  createdAt: string; preferredVendor: Vendor | null; approvalPolicy: Policy | null
  requestCount: number
}

interface Props {
  initialItems: CatalogItem[]
  vendors: Vendor[]
  policies: Policy[]
}

const CATEGORIES = [
  "GENERAL", "Cleaning Supplies", "Janitorial", "PPE", "Office Supplies",
  "Warehouse Supplies", "Safety Equipment", "Maintenance Parts", "Other",
]

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
const selectCls = `${inputCls} bg-white`

function ItemModal({
  item, vendors, policies, onClose, onSaved,
}: {
  item: CatalogItem | null
  vendors: Vendor[]
  policies: Policy[]
  onClose: () => void
  onSaved: (item: CatalogItem) => void
}) {
  const [name, setName]             = useState(item?.name ?? "")
  const [category, setCategory]     = useState(item?.category ?? "GENERAL")
  const [description, setDesc]      = useState(item?.description ?? "")
  const [vendorId, setVendorId]     = useState(item?.preferredVendor?.id ?? "")
  const [vendorSku, setVendorSku]   = useState(item?.vendorSku ?? "")
  const [manufacturer, setMfr]      = useState(item?.manufacturer ?? "")
  const [modelNumber, setModel]     = useState(item?.modelNumber ?? "")
  const [estimatedCost, setCost]    = useState(item?.estimatedCost?.toString() ?? "")
  const [replacementUrl, setUrl]    = useState(item?.replacementUrl ?? "")
  const [policyId, setPolicyId]     = useState(item?.approvalPolicy?.id ?? "")
  const [autoApprove, setAutoApprove] = useState(item?.autoApproveBelow?.toString() ?? "")
  const [notes, setNotes]           = useState(item?.notes ?? "")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const payload = {
        name, category, description: description || null, preferredVendorId: vendorId || null,
        vendorSku: vendorSku || null, manufacturer: manufacturer || null,
        modelNumber: modelNumber || null,
        estimatedCost: estimatedCost ? Number(estimatedCost) : null,
        replacementUrl: replacementUrl || null,
        approvalPolicyId: policyId || null,
        autoApproveBelow: autoApprove ? Number(autoApprove) : null,
        notes: notes || null,
      }
      const res = await fetch(item ? `/api/catalog-items/${item.id}` : "/api/catalog-items", {
        method: item ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Save failed"); return }
      const saved = await res.json() as CatalogItem & {
        _count?: { purchaseRequests: number }
        preferredVendor?: Vendor | null
        approvalPolicy?: Policy | null
      }
      onSaved({
        ...saved,
        requestCount: saved._count?.purchaseRequests ?? item?.requestCount ?? 0,
        preferredVendor: saved.preferredVendor ?? null,
        approvalPolicy: saved.approvalPolicy ?? null,
      })
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{item ? "Edit Catalog Item" : "Add Catalog Item"}</h2>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Industrial Mop Head" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Vendor</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={selectCls}>
              <option value="">— None —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor SKU / Part #</label>
            <input value={vendorSku} onChange={e => setVendorSku(e.target.value)} placeholder="SKU-12345" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer</label>
            <input value={manufacturer} onChange={e => setMfr(e.target.value)} placeholder="Brand name" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model Number</label>
            <input value={modelNumber} onChange={e => setModel(e.target.value)} placeholder="MOD-XYZ" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost ($)</label>
            <input type="number" min="0" step="0.01" value={estimatedCost} onChange={e => setCost(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Brief description" className={inputCls + " resize-none"} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Replacement URL (optional)</label>
            <input value={replacementUrl} onChange={e => setUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Approval Policy</label>
            <select value={policyId} onChange={e => setPolicyId(e.target.value)} className={selectCls}>
              <option value="">— Use default policy —</option>
              {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Auto-Approve Below ($)</label>
            <input type="number" min="0" step="0.01" value={autoApprove} onChange={e => setAutoApprove(e.target.value)} placeholder="Override threshold" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes" className={inputCls + " resize-none"} />
          </div>
          {error && <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
            {saving ? "Saving…" : item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CatalogClient({ initialItems, vendors, policies }: Props) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("")
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("")
  const [editing, setEditing] = useState<CatalogItem | null | "new">(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState("")
  const csvRef = useRef<HTMLInputElement>(null)

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !i.category.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && i.category !== filterCat) return false
    if (filterActive === "true" && !i.isActive) return false
    if (filterActive === "false" && i.isActive) return false
    return true
  })

  function handleSaved(saved: CatalogItem) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
    setEditing(null)
  }

  async function handleToggleActive(item: CatalogItem) {
    const res = await fetch(`/api/catalog-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    })
    if (res.ok) {
      const updated = await res.json() as CatalogItem & { _count?: { purchaseRequests: number } }
      setItems(prev => prev.map(i => i.id === updated.id ? { ...updated, requestCount: i.requestCount } : i))
    }
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/catalog-items/${item.id}`, { method: "DELETE" })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportMsg("")
    try {
      const text = await file.text()
      const res = await fetch("/api/catalog-items/import", { method: "POST", body: text })
      const data = await res.json() as { imported: number; errors: string[] }
      setImportMsg(`Imported ${data.imported} items${data.errors.length ? `. ${data.errors.length} errors.` : "."}`)
      // Refresh list
      const fresh = await fetch("/api/catalog-items").then(r => r.json()) as (CatalogItem & { _count: { purchaseRequests: number } })[]
      setItems(fresh.map(i => ({ ...i, requestCount: i._count.purchaseRequests })))
    } catch { setImportMsg("Import failed.") } finally { setImporting(false); if (csvRef.current) csvRef.current.value = "" }
  }

  const csvTemplate = "name,category,description,vendor_sku,manufacturer,model_number,estimated_cost,replacement_url,auto_approve_below,notes"

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/approval-intelligence" className="hover:text-gray-700">Approval Intelligence</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Approved Item Catalog</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value as typeof filterActive)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <div className="flex gap-2">
          <button onClick={() => { const el = document.createElement("a"); el.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvTemplate + "\n"); el.download = "catalog_template.csv"; el.click() }} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
            <Download className="w-4 h-4" /> Template
          </button>
          <button onClick={() => csvRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
            <Upload className="w-4 h-4" /> {importing ? "Importing…" : "Import CSV"}
          </button>
          <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCsvImport} className="hidden" />
          <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">{importMsg}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span>Item</span>
          <span className="text-right pr-6">Cost</span>
          <span className="text-center pr-6">Requests</span>
          <span className="text-center pr-6">Status</span>
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-10 h-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No catalog items yet</p>
            <p className="text-xs mt-1">Add items manually or import a CSV.</p>
          </div>
        )}

        {filtered.map(item => (
          <div key={item.id} className="border-b border-gray-100 last:border-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-5 py-4 hover:bg-gray-50">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-sm font-medium text-gray-900 text-left hover:text-indigo-600 truncate">
                    {item.name}
                  </button>
                  {expanded === item.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Tag className="w-3 h-3" /> {item.category}
                  </span>
                  {item.preferredVendor && <span className="text-xs text-gray-400">· {item.preferredVendor.name}</span>}
                  {item.autoApproveBelow && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                      Auto ≤${item.autoApproveBelow}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-700 font-medium pr-6 text-right">
                {item.estimatedCost != null ? `$${item.estimatedCost.toFixed(2)}` : <span className="text-gray-400 text-xs">—</span>}
              </div>
              <div className="text-sm text-gray-600 pr-6 text-center">{item.requestCount}</div>
              <div className="pr-6 text-center">
                <button onClick={() => handleToggleActive(item)} title={item.isActive ? "Deactivate" : "Activate"}>
                  {item.isActive
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-gray-300" />}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(item)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {expanded === item.id && (
              <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {item.manufacturer && <div><p className="text-gray-400 mb-0.5">Manufacturer</p><p className="text-gray-700">{item.manufacturer}</p></div>}
                {item.modelNumber  && <div><p className="text-gray-400 mb-0.5">Model</p><p className="text-gray-700">{item.modelNumber}</p></div>}
                {item.vendorSku    && <div><p className="text-gray-400 mb-0.5">SKU / Part #</p><p className="text-gray-700 font-mono">{item.vendorSku}</p></div>}
                {item.approvalPolicy && <div><p className="text-gray-400 mb-0.5">Policy</p><p className="text-gray-700">{item.approvalPolicy.name}</p></div>}
                {item.description  && <div className="col-span-2 md:col-span-4"><p className="text-gray-400 mb-0.5">Description</p><p className="text-gray-700">{item.description}</p></div>}
                {item.notes        && <div className="col-span-2 md:col-span-4"><p className="text-gray-400 mb-0.5">Notes</p><p className="text-gray-700">{item.notes}</p></div>}
                {item.replacementUrl && (
                  <div className="col-span-2 md:col-span-4">
                    <a href={item.replacementUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Replacement URL
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-right">{filtered.length} of {items.length} items</p>

      {editing !== null && (
        <ItemModal
          item={editing === "new" ? null : editing as CatalogItem}
          vendors={vendors}
          policies={policies}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
