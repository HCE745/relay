"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Search, Loader2, X, ChevronLeft, ChevronDown, ChevronUp, ExternalLink,
  MapPin, Users, Zap, CheckCircle2, AlertTriangle,
  Building2, Star, Mail, Globe, User, Plus, Send,
  Phone, Link2, FileText, Calendar, Clock, MousePointerClick,
  Bookmark, BookmarkCheck, Trash2, FolderOpen, PenLine, ArrowRight,
  RefreshCw, ChevronRight, List as ListIcon,
} from "lucide-react"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "@/app/api/super-admin/crm/prospects/discover/route"

// ─── Types ────────────────────────────────────────────────────────────────────

type NavSection  = "search" | "lists" | "prospects"
type SearchState = "idle" | "loading" | "done" | "error"
type DetailsState = "loading" | "ready" | "error"
type PanelStep   = "contact" | "action" | "email" | "log"

interface ContactDraft {
  name:     string
  title:    string
  email:    string
  phone:    string
  linkedin: string
  notes:    string
}

interface Template { id: string; name: string; subject: string; body: string }

interface ProspectCreated {
  prospectId:   string
  contactId:    string | null
  contactEmail: string
}

interface SavedContact {
  id:         string
  name:       string
  title:      string
  email:      string
  prospectId: string
}

interface ResearchList {
  id:              string
  name:            string
  description:     string | null
  isShared:        boolean
  ownedByMe:       boolean
  searchCountry:   string | null
  searchState:     string | null
  searchIndustry:  string | null
  searchEmpMin:    number | null
  searchEmpMax:    number | null
  searchKeywords:  string | null
  searchContext:   string | null
  createdAt:       string
  _count:          { results: number }
}

interface ResearchResult {
  id:                string
  listId:            string
  companyName:       string
  website:           string | null
  verifiedCity:      string | null
  verifiedState:     string | null
  verifiedCountry:   string | null
  industry:          string | null
  estimatedEmployees: string | null
  summary:           string | null
  fitScore:          number | null
  painPoints:        string[]
  relayFitReasons:   string[]
  outreachAngle:     string | null
  prospectId:        string | null
  researchDate:      string
}

interface ResearchListWithResults extends ResearchList {
  results: ResearchResult[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fitBadge(score: number) {
  if (score >= 80) return { bg: "bg-green-900/40",  border: "border-green-700/50",  text: "text-green-400"  }
  if (score >= 60) return { bg: "bg-amber-900/40",  border: "border-amber-700/50",  text: "text-amber-400"  }
  return              { bg: "bg-red-900/30",      border: "border-red-800/50",    text: "text-red-400"    }
}

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
  catch { return "" }
}

function applyMergeFields(text: string, ctx: { companyName: string; city?: string; firstName?: string }): string {
  return text
    .replace(/\{\{companyName\}\}/g, ctx.companyName)
    .replace(/\{\{city\}\}/g, ctx.city ?? "")
    .replace(/\{\{firstName\}\}/g, ctx.firstName ?? "")
}

function resultToBasic(r: ResearchResult): DiscoveredCompanyBasic {
  return {
    companyName:        r.companyName,
    website:            r.website ?? "",
    city:               r.verifiedCity ?? "",
    state:              r.verifiedState ?? "",
    country:            r.verifiedCountry ?? "United States",
    industry:           r.industry ?? "",
    estimatedEmployees: r.estimatedEmployees ?? "",
    summary:            r.summary ?? "",
    fitScore:           r.fitScore ?? 70,
    crmStatus:          r.prospectId ? "in_crm" : "none",
    crmProspectId:      r.prospectId ?? undefined,
  }
}

function buildAutoName(params: {
  industry?: string; stateProvince?: string; country?: string; keywords?: string
}): string {
  const parts: string[] = []
  if (params.stateProvince) parts.push(params.stateProvince)
  if (params.industry)      parts.push(params.industry)
  if (parts.length === 0 && params.country) parts.push(params.country)
  if (params.keywords)      parts.push(params.keywords)
  if (parts.length === 0)   parts.push("Prospect Search")
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `${parts.join(" · ")} — ${date}`
}

// ─── Company Card (search results) ───────────────────────────────────────────

function CompanyCard({ company, selected, onClick }: {
  company:  DiscoveredCompanyBasic
  selected: boolean
  onClick:  () => void
}) {
  const badge = fitBadge(company.fitScore)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${
        selected ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-[14px] leading-snug">{company.companyName}</h3>
            {company.crmStatus === "contacted" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50 flex-shrink-0">
                <CheckCircle2 className="w-2 h-2" />
                Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
              </span>
            )}
            {company.crmStatus === "in_crm" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50 flex-shrink-0">
                <Building2 className="w-2 h-2" />
                In CRM
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
            {(company.city || company.state) && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {[company.city, company.state].filter(Boolean).join(", ")}
              </span>
            )}
            {company.estimatedEmployees && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{company.estimatedEmployees} emp.
              </span>
            )}
            {company.website && (
              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors"
                onClick={e => e.stopPropagation()}>
                <ExternalLink className="w-2.5 h-2.5" />{cleanUrl(company.website)}
              </a>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-lg border ${badge.bg} ${badge.border}`}>
          <span className={`text-lg font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
          <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
        </div>
      </div>
      {company.industry && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60 mb-2">
          <Building2 className="w-2.5 h-2.5" />{company.industry}
        </span>
      )}
      {company.summary && (
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2">{company.summary}</p>
      )}
    </button>
  )
}

// ─── List Result Card (saved lists view) ──────────────────────────────────────

function ListResultCard({
  result,
  onAddToCRM,
  addingId,
}: {
  result:    ResearchResult
  onAddToCRM: (resultId: string) => void
  addingId:  string | null
}) {
  const badge = fitBadge(result.fitScore ?? 70)
  const isAdding = addingId === result.id
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-[14px] leading-snug">{result.companyName}</h3>
            {result.prospectId && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50 flex-shrink-0">
                <Building2 className="w-2 h-2" />
                In CRM
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
            {(result.verifiedCity || result.verifiedState) && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {[result.verifiedCity, result.verifiedState].filter(Boolean).join(", ")}
              </span>
            )}
            {result.estimatedEmployees && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{result.estimatedEmployees} emp.
              </span>
            )}
            {result.website && (
              <a href={result.website.startsWith("http") ? result.website : `https://${result.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors">
                <ExternalLink className="w-2.5 h-2.5" />{cleanUrl(result.website)}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg border ${badge.bg} ${badge.border}`}>
            <span className={`text-lg font-bold leading-none tabular-nums ${badge.text}`}>{result.fitScore ?? "—"}</span>
            <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
          </div>
          {result.prospectId ? (
            <Link
              href={`/sales/prospects/${result.prospectId}`}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
            >
              View <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          ) : (
            <button
              onClick={() => onAddToCRM(result.id)}
              disabled={isAdding}
              className="text-[10px] px-2 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/40 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isAdding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
              Add to CRM
            </button>
          )}
        </div>
      </div>
      {result.industry && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60 mb-2">
          <Building2 className="w-2.5 h-2.5" />{result.industry}
        </span>
      )}
      {result.summary && (
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2">{result.summary}</p>
      )}
    </div>
  )
}

// ─── Saved Lists Section ──────────────────────────────────────────────────────

function SavedListsSection({ onRunSearch }: {
  onRunSearch: (params: {
    country: string; stateProvince: string; industry: string
    empMin: string; empMax: string; keywords: string; context: string
    appendToListId?: string
  }) => void
}) {
  const [lists,       setLists]       = useState<ResearchList[] | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [openList,    setOpenList]    = useState<ResearchListWithResults | null>(null)
  const [loadingList, setLoadingList] = useState<string | null>(null)
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameVal,   setRenameVal]   = useState("")
  const [savingRename, setSavingRename] = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [addingId,    setAddingId]    = useState<string | null>(null)
  const [findingMore, setFindingMore] = useState(false)
  const [findMoreErr, setFindMoreErr] = useState<string | null>(null)
  const [findMoreCount, setFindMoreCount] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch("/api/super-admin/crm/prospects/discover/lists")
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setLists(d as ResearchList[]); setLoading(false) })
      .catch(() => { setError("Failed to load lists"); setLoading(false) })
  }, [])

  async function openListDetail(list: ResearchList) {
    setLoadingList(list.id)
    setFindMoreErr(null)
    setFindMoreCount(null)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${list.id}`)
      if (!res.ok) throw new Error("Failed to load list")
      const data = await res.json() as ResearchListWithResults
      setOpenList(data)
    } catch {
      setError("Failed to load list details")
    } finally {
      setLoadingList(null)
    }
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) return
    setSavingRename(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: renameVal.trim() }),
      })
      if (!res.ok) throw new Error("Rename failed")
      const updated = await res.json() as ResearchList & { _count: { results: number } }
      setLists(prev => prev?.map(l => l.id === id ? { ...l, name: updated.name } : l) ?? null)
      if (openList?.id === id) setOpenList(prev => prev ? { ...prev, name: updated.name } : null)
    } finally {
      setSavingRename(false)
      setRenamingId(null)
      setRenameVal("")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this list? Results that have been added to CRM will not be affected.")) return
    setDeletingId(id)
    try {
      await fetch(`/api/super-admin/crm/prospects/discover/lists/${id}`, { method: "DELETE" })
      setLists(prev => prev?.filter(l => l.id !== id) ?? null)
      if (openList?.id === id) setOpenList(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAddToCRM(resultId: string) {
    if (!openList) return
    setAddingId(resultId)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${openList.id}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultIds: [resultId] }),
      })
      if (!res.ok) return
      const { promoted } = await res.json() as { promoted: { resultId: string; prospectId: string }[] }
      const p = promoted.find(x => x.resultId === resultId)
      if (p) {
        setOpenList(prev => prev ? {
          ...prev,
          results: prev.results.map(r => r.id === resultId ? { ...r, prospectId: p.prospectId } : r),
        } : null)
      }
    } finally {
      setAddingId(null)
    }
  }

  async function handleFindMore() {
    if (!openList) return
    setFindingMore(true)
    setFindMoreErr(null)
    setFindMoreCount(null)
    try {
      // Run a fresh search with the same criteria
      const body: Record<string, unknown> = {
        country: openList.searchCountry ?? "United States",
      }
      if (openList.searchState)    body.stateProvince    = openList.searchState
      if (openList.searchIndustry) body.industry         = openList.searchIndustry
      if (openList.searchEmpMin)   body.employeeCountMin = openList.searchEmpMin
      if (openList.searchEmpMax)   body.employeeCountMax = openList.searchEmpMax
      if (openList.searchKeywords) body.keywords         = openList.searchKeywords
      if (openList.searchContext)  body.additionalContext = openList.searchContext

      const res = await fetch("/api/super-admin/crm/prospects/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? "Search failed")
      }
      const { companies } = await res.json() as { companies: DiscoveredCompanyBasic[] }
      if (!companies.length) { setFindMoreErr("No additional companies found"); return }

      // Append to list
      const appendRes = await fetch(`/api/super-admin/crm/prospects/discover/lists/${openList.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ results: companies }),
      })
      if (!appendRes.ok) throw new Error("Failed to append results")
      const { appended } = await appendRes.json() as { appended: number; skipped: number }

      // Reload the list
      const refreshed = await fetch(`/api/super-admin/crm/prospects/discover/lists/${openList.id}`)
      if (refreshed.ok) {
        const data = await refreshed.json() as ResearchListWithResults
        setOpenList(data)
        setLists(prev => prev?.map(l => l.id === openList.id
          ? { ...l, _count: { results: data.results.length } } : l) ?? null)
      }
      setFindMoreCount(appended)
    } catch (err) {
      setFindMoreErr(err instanceof Error ? err.message : "Find More failed")
    } finally {
      setFindingMore(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-center text-red-400 text-sm">{error}</div>
  )

  // ── Detail view: open list ──────────────────────────────────────────────────
  if (openList) {
    const promoted = openList.results.filter(r => r.prospectId).length
    return (
      <div className="flex flex-col h-full">
        {/* List header */}
        <div className="border-b border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => { setOpenList(null); setFindMoreErr(null); setFindMoreCount(null) }}
              className="text-gray-400 hover:text-gray-200 transition-colors p-0.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {renamingId === openList.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleRename(openList.id); if (e.key === "Escape") { setRenamingId(null); setRenameVal("") } }}
                  className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                />
                <button
                  onClick={() => void handleRename(openList.id)}
                  disabled={savingRename}
                  className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
                >
                  {savingRename ? "…" : "Save"}
                </button>
                <button onClick={() => { setRenamingId(null); setRenameVal("") }} className="text-gray-400 hover:text-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">{openList.name}</h2>
                <button
                  onClick={() => { setRenamingId(openList.id); setRenameVal(openList.name) }}
                  className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                  title="Rename list"
                >
                  <PenLine className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 ml-6">
            <span>{openList.results.length} companies</span>
            {promoted > 0 && <span className="text-indigo-400">{promoted} in CRM</span>}
            {openList.searchState && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{openList.searchState}</span>}
            {openList.searchIndustry && <span>{openList.searchIndustry}</span>}
            <span>{formatDate(openList.createdAt)}</span>
          </div>

          {/* Find More / status */}
          <div className="mt-2.5 ml-6 flex items-center gap-3">
            <button
              onClick={() => void handleFindMore()}
              disabled={findingMore}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {findingMore
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding more…</>
                : <><RefreshCw className="w-3 h-3" /> Find More Companies</>
              }
            </button>
            {findMoreCount !== null && (
              <span className="text-[11px] text-green-400">+{findMoreCount} new companies added</span>
            )}
            {findMoreErr && (
              <span className="text-[11px] text-red-400">{findMoreErr}</span>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {openList.results.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No companies in this list yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {openList.results.map(r => (
                <ListResultCard
                  key={r.id}
                  result={r}
                  onAddToCRM={handleAddToCRM}
                  addingId={addingId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── List index ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {(!lists || lists.length === 0) ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
          <Bookmark className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium mb-1">No saved lists yet</p>
          <p className="text-sm text-gray-600">
            Research results are saved automatically after each search. Run a search to get started.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-gray-500 mb-3">{lists.length} saved {lists.length === 1 ? "list" : "lists"}</p>
          <div className="space-y-2">
            {lists.map(list => (
              <div key={list.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {renamingId === list.id ? (
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") void handleRename(list.id); if (e.key === "Escape") { setRenamingId(null); setRenameVal("") } }}
                          className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                        />
                        <button onClick={() => void handleRename(list.id)} disabled={savingRename}
                          className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md">
                          {savingRename ? "…" : "Save"}
                        </button>
                        <button onClick={() => { setRenamingId(null); setRenameVal("") }} className="text-gray-400 hover:text-gray-200">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">{list.name}</h3>
                        <button
                          onClick={() => { setRenamingId(list.id); setRenameVal(list.name) }}
                          className="text-gray-600 hover:text-gray-400 flex-shrink-0"
                        >
                          <PenLine className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                      <span className="text-gray-400 font-medium">{list._count.results} companies</span>
                      {list.searchState && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{list.searchState}</span>}
                      {list.searchIndustry && <span>{list.searchIndustry}</span>}
                      {list.searchEmpMin && list.searchEmpMax && (
                        <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{list.searchEmpMin}–{list.searchEmpMax}</span>
                      )}
                      <span>{formatDate(list.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => void handleDelete(list.id)}
                      disabled={deletingId === list.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1"
                    >
                      {deletingId === list.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => void openListDetail(list)}
                      disabled={loadingList === list.id}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/40 rounded-lg transition-colors"
                    >
                      {loadingList === list.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
                        : <><FolderOpen className="w-3 h-3" /> Open</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Slide-over (contact/email/log workflow) ──────────────────────────────────

function SlideOver({ company, onClose }: {
  company: DiscoveredCompanyBasic
  onClose: () => void
}) {
  const badge = fitBadge(company.fitScore)
  const websiteHref = company.website
    ? (company.website.startsWith("http") ? company.website : `https://${company.website}`)
    : null

  const [detailsState, setDetailsState] = useState<DetailsState>("loading")
  const [details,      setDetails]      = useState<DiscoveredCompanyDetails | null>(null)
  const [detailsErr,   setDetailsErr]   = useState<string | null>(null)

  const [sectionOpen, setSectionOpen] = useState({ contact: true, outreach: false, contacts: false })
  function toggleSection(s: "contact" | "outreach" | "contacts") {
    setSectionOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])
  const [created, setCreated]             = useState<ProspectCreated | null>(null)

  const blankContact = (): ContactDraft => ({ name: "", title: "", email: "", phone: "", linkedin: "", notes: "" })
  const [contact, setContact]           = useState<ContactDraft>(blankContact())
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [lastSaved, setLastSaved]       = useState<string | null>(null)

  type OutreachTab = "email" | "log" | "followup"
  const [outreachTab, setOutreachTab]           = useState<OutreachTab>("email")
  const [outreachContactId, setOutreachContactId] = useState<string>("")

  const [followupTitle, setFollowupTitle]     = useState("")
  const [followupType, setFollowupType]       = useState("other")
  const [followupDueAt, setFollowupDueAt]     = useState("")
  const [followupNotes, setFollowupNotes]     = useState("")
  const [followupPriority, setFollowupPriority] = useState("normal")
  const [savingFollowup, setSavingFollowup]   = useState(false)
  const [followupError, setFollowupError]     = useState<string | null>(null)
  const [followupSaved, setFollowupSaved]     = useState(false)

  const [templates, setTemplates]             = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")

  const [emailTo, setEmailTo]           = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody]       = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [emailSent, setEmailSent]       = useState(false)
  const [insertingLink, setInsertingLink] = useState(false)
  const emailBodyRef = useRef<HTMLTextAreaElement>(null)

  const [logType, setLogType]           = useState("CALL_CONNECTED")
  const [logCustomType, setLogCustomType] = useState("")
  const [logOutcome, setLogOutcome]     = useState("")
  const [logDuration, setLogDuration]   = useState("")
  const [logNotes, setLogNotes]         = useState("")
  const [savingLog, setSavingLog]       = useState(false)
  const [logError, setLogError]         = useState<string | null>(null)
  const [logSaved, setLogSaved]         = useState(false)

  useEffect(() => {
    async function fetchDetails() {
      setDetailsState("loading")
      setDetailsErr(null)
      try {
        const res = await fetch("/api/super-admin/crm/prospects/discover/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company }),
        })
        if (!res.ok) throw new Error(`Details failed (${res.status})`)
        const data = await res.json() as DiscoveredCompanyDetails
        setDetails(data)
        setDetailsState("ready")
      } catch (err) {
        setDetailsErr(err instanceof Error ? err.message : "Failed to load research")
        setDetailsState("error")
      }
    }
    void fetchDetails()
  }, [company])

  useEffect(() => {
    if (!sectionOpen.outreach || templates.length > 0) return
    fetch("/api/sales/templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then((d: { templates: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => {})
  }, [sectionOpen.outreach, templates.length])

  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId)
    if (!tmpl) return
    const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
    const ctx = {
      companyName: company.companyName,
      city: company.city ?? "",
      firstName: sc?.name.split(" ")[0] ?? "",
    }
    setEmailSubject(applyMergeFields(tmpl.subject, ctx))
    setEmailBody(applyMergeFields(tmpl.body, ctx))
    setSelectedTemplate(templateId)
  }, [templates, company, savedContacts, outreachContactId])

  async function handleSaveContact() {
    if (!contact.name.trim()) { setContactError("Contact name is required"); return }
    setSavingContact(true)
    setContactError(null)
    try {
      const prospectPayload = {
        companyName: company.companyName,
        website: company.website ?? null,
        industry: company.industry ?? null,
        headquartersCity: company.city ?? null,
        headquartersState: company.state ?? null,
        aiFitScore: company.fitScore ?? null,
        source: "ai_research",
        initialContact: {
          name: contact.name.trim(),
          title: contact.title.trim() || null,
          email: contact.email.trim() || null,
          phone: contact.phone.trim() || null,
          linkedinUrl: contact.linkedin.trim() || null,
          notes: contact.notes.trim() || null,
        },
        initialInteraction: null,
      }

      let res = await fetch("/api/sales/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...prospectPayload, confirmDuplicate: false }),
      })

      if (res.status === 409) {
        const dup = await res.json() as { existing?: { id: string } }
        const existingId = dup.existing?.id
        if (existingId) {
          const r2 = await fetch(`/api/sales/companies/${existingId}/contacts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(prospectPayload.initialContact),
          })
          if (r2.ok) {
            const d2 = await r2.json() as { contact: { id: string } }
            pushContact({ id: d2.contact.id, name: contact.name.trim(), title: contact.title.trim(), email: contact.email.trim(), prospectId: existingId })
            return
          }
          pushContact({ id: "", name: contact.name.trim(), title: contact.title.trim(), email: contact.email.trim(), prospectId: existingId })
          return
        }
        res = await fetch("/api/sales/prospects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...prospectPayload, confirmDuplicate: true }),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setContactError(data.error ?? "Failed to save contact")
        return
      }
      const data = await res.json() as { prospect: { id: string; contacts?: { id: string }[] } }
      pushContact({
        id: data.prospect.contacts?.[0]?.id ?? "",
        name: contact.name.trim(),
        title: contact.title.trim(),
        email: contact.email.trim(),
        prospectId: data.prospect.id,
      })
    } catch {
      setContactError("Network error — please try again")
    } finally {
      setSavingContact(false)
    }
  }

  function pushContact(newContact: SavedContact) {
    setSavedContacts(prev => [...prev, newContact])
    setCreated({ prospectId: newContact.prospectId, contactId: newContact.id || null, contactEmail: newContact.email })
    setOutreachContactId(newContact.id)
    if (newContact.email) setEmailTo(newContact.email)
    setLastSaved(newContact.name)
    setContact(blankContact())
    setSectionOpen(prev => ({ ...prev, outreach: true, contacts: true }))
  }

  async function handleSendEmail() {
    if (!created) return
    if (!emailTo.trim()) { setEmailError("Recipient email required"); return }
    if (!emailSubject.trim()) { setEmailError("Subject required"); return }
    if (!emailBody.trim()) { setEmailError("Body required"); return }
    setSendingEmail(true)
    setEmailError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
      const res = await fetch(`/api/sales/prospects/${created.prospectId}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject,
          emailBody,
          contactId: sc?.id || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setEmailError(data.error ?? "Send failed")
        return
      }
      setEmailSent(true)
      setEmailSubject("")
      setEmailBody("")
      setSelectedTemplate("")
    } finally {
      setSendingEmail(false)
    }
  }

  async function insertDemoLink() {
    if (!created) return
    setInsertingLink(true)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
      const res = await fetch("/api/sales/demo-link/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: created.prospectId,
          contactId:  sc?.id ?? null,
        }),
      })
      if (!res.ok) return
      const { url } = await res.json() as { url: string }
      const ta = emailBodyRef.current
      if (ta) {
        const start = ta.selectionStart ?? emailBody.length
        const end   = ta.selectionEnd   ?? emailBody.length
        const next  = emailBody.slice(0, start) + url + emailBody.slice(end)
        setEmailBody(next)
        setTimeout(() => {
          ta.selectionStart = start + url.length
          ta.selectionEnd   = start + url.length
          ta.focus()
        }, 0)
      } else {
        setEmailBody(b => b ? `${b}\n\n${url}` : url)
      }
    } finally {
      setInsertingLink(false)
    }
  }

  async function handleLogInteraction() {
    if (!created) return
    setSavingLog(true)
    setLogError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId)
      const res = await fetch("/api/sales/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospectId: created.prospectId,
          contactId: sc?.id || null,
          activityType: logType,
          subject: logType === "OTHER" && logCustomType.trim() ? logCustomType.trim() : null,
          outcome: logOutcome.trim() || null,
          notes: logNotes.trim() || null,
          durationMinutes: logDuration ? parseInt(logDuration, 10) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setLogError(data.error ?? "Failed to log interaction")
        return
      }
      setLogSaved(true)
      setLogOutcome("")
      setLogDuration("")
      setLogNotes("")
      setLogCustomType("")
    } finally {
      setSavingLog(false)
    }
  }

  async function handleCreateFollowup() {
    if (!created || !followupTitle.trim()) return
    setSavingFollowup(true)
    setFollowupError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId)
      const res = await fetch("/api/sales/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: followupTitle.trim(),
          taskType: followupType,
          priority: followupPriority,
          dueAt: followupDueAt || null,
          notes: followupNotes.trim() || null,
          prospectId: created.prospectId,
          contactId: sc?.id || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setFollowupError(data.error ?? "Failed to create follow-up")
        return
      }
      setFollowupSaved(true)
      setFollowupTitle("")
      setFollowupType("other")
      setFollowupDueAt("")
      setFollowupNotes("")
      setFollowupPriority("normal")
    } finally {
      setSavingFollowup(false)
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const sectionHdrCls = "w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full sm:w-[520px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-base leading-snug">{company.companyName}</h2>
              {company.crmStatus === "contacted" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50">
                  <CheckCircle2 className="w-2 h-2" />
                  Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
                </span>
              )}
              {company.crmStatus === "in_crm" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50">
                  <Building2 className="w-2 h-2" />
                  In CRM
                  {company.crmProspectId && (
                    <Link href={`/sales/prospects/${company.crmProspectId}`} onClick={e => e.stopPropagation()}
                      className="ml-0.5 opacity-70 hover:opacity-100">
                      <ExternalLink className="w-2 h-2" />
                    </Link>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-gray-400">
              {(company.city || company.state) && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {[company.city, company.state].filter(Boolean).join(", ")}
                </span>
              )}
              {company.estimatedEmployees && (
                <span className="flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />{company.estimatedEmployees} emp.
                </span>
              )}
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors">
                  <Globe className="w-2.5 h-2.5" />{cleanUrl(company.website)}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg border ${badge.bg} ${badge.border}`}>
              <span className={`text-base font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
              <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Research summary */}
          <div className="px-5 py-4 border-b border-gray-800/60">
            {detailsState === "loading" && (
              <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading research…
              </div>
            )}
            {detailsState === "error" && (
              <p className="text-[12px] text-red-400">{detailsErr}</p>
            )}
            {detailsState === "ready" && details && (
              <div className="space-y-3">
                {details.summary && (
                  <p className="text-[12px] text-gray-300 leading-relaxed">{details.summary}</p>
                )}
                {details.industry && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60">
                    <Building2 className="w-2.5 h-2.5" />{details.industry}
                  </span>
                )}
                {details.painPoints?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Operational Pain Points</p>
                    <ul className="space-y-1">
                      {details.painPoints.map((p, i) => (
                        <li key={i} className="text-[12px] text-gray-400 flex gap-1.5">
                          <span className="text-orange-500 mt-0.5">·</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {details.suggestedOutreachAngle && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Suggested Angle</p>
                    <p className="text-[12px] text-indigo-300 italic leading-relaxed">{details.suggestedOutreachAngle}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 1: Contact ──────────────────────────────────────── */}
          <div className="border-b border-gray-800/60">
            <button className={sectionHdrCls} onClick={() => toggleSection("contact")}>
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-200 flex-1">Save a Contact</span>
              {sectionOpen.contact ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {sectionOpen.contact && (
              <div className="px-4 pb-4 space-y-3">
                {lastSaved && (
                  <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span><span className="font-medium">{lastSaved}</span> saved. Add another contact below.</span>
                  </div>
                )}
                <input type="text" placeholder="Contact name *" value={contact.name}
                  onChange={e => setContact(c => ({ ...c, name: e.target.value }))} className={inputCls} />
                <input type="text" placeholder="Title / role" value={contact.title}
                  onChange={e => setContact(c => ({ ...c, title: e.target.value }))} className={inputCls} />
                <input type="email" placeholder="Email" value={contact.email}
                  onChange={e => setContact(c => ({ ...c, email: e.target.value }))} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="tel" placeholder="Phone" value={contact.phone}
                    onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} className={inputCls} />
                  <input type="url" placeholder="LinkedIn URL" value={contact.linkedin}
                    onChange={e => setContact(c => ({ ...c, linkedin: e.target.value }))} className={inputCls} />
                </div>
                <textarea rows={2} placeholder="Notes…" value={contact.notes}
                  onChange={e => setContact(c => ({ ...c, notes: e.target.value }))}
                  className={`${inputCls} resize-none`} />
                {contactError && <p className="text-[12px] text-red-400">{contactError}</p>}
                <button
                  onClick={() => void handleSaveContact()}
                  disabled={savingContact || !contact.name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingContact
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Plus className="w-3.5 h-3.5" /> Save Contact & Add to CRM</>}
                </button>
              </div>
            )}
          </div>

          {/* ── Section 2: Outreach ─────────────────────────────────────── */}
          <div className="border-b border-gray-800/60">
            <button className={sectionHdrCls} onClick={() => toggleSection("outreach")}>
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-200 flex-1">Outreach</span>
              {!created && <span className="text-[10px] text-gray-600 mr-1">Save a contact first</span>}
              {sectionOpen.outreach ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {sectionOpen.outreach && (
              <div className="px-4 pb-4">
                {!created ? (
                  <p className="text-[12px] text-gray-500 py-2">Save a contact above to unlock outreach.</p>
                ) : (
                  <>
                    {/* Contact selector */}
                    {savedContacts.length > 1 && (
                      <div className="mb-3">
                        <label className="block text-[11px] text-gray-500 mb-1">Sending to</label>
                        <select
                          value={outreachContactId}
                          onChange={e => {
                            setOutreachContactId(e.target.value)
                            const sc = savedContacts.find(c => c.id === e.target.value)
                            if (sc?.email) setEmailTo(sc.email)
                          }}
                          className={inputCls}
                        >
                          {savedContacts.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Sub-tabs */}
                    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5 mb-3">
                      {(["email", "log", "followup"] as OutreachTab[]).map(tab => (
                        <button key={tab}
                          onClick={() => setOutreachTab(tab)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${outreachTab === tab ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                        >
                          {tab === "email" && <><Mail className="w-3 h-3" /> Email</>}
                          {tab === "log"   && <><FileText className="w-3 h-3" /> Log</>}
                          {tab === "followup" && <><Clock className="w-3 h-3" /> Follow-up</>}
                        </button>
                      ))}
                    </div>

                    {/* Email tab */}
                    {outreachTab === "email" && (
                      <div className="space-y-2">
                        {emailSent && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Email sent!
                          </div>
                        )}
                        {templates.length > 0 && (
                          <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)} className={inputCls}>
                            <option value="">Use a template…</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        <input type="email" placeholder="To" value={emailTo}
                          onChange={e => setEmailTo(e.target.value)} className={inputCls} />
                        <input type="text" placeholder="Subject" value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)} className={inputCls} />
                        <div className="relative">
                          <textarea ref={emailBodyRef} rows={6} placeholder="Message…" value={emailBody}
                            onChange={e => setEmailBody(e.target.value)} className={`${inputCls} resize-none`} />
                        </div>
                        <button
                          onClick={() => void insertDemoLink()}
                          disabled={insertingLink}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                        >
                          <Link2 className="w-3 h-3" />
                          {insertingLink ? "Inserting…" : "Insert demo link"}
                        </button>
                        {emailError && <p className="text-[12px] text-red-400">{emailError}</p>}
                        <button
                          onClick={() => void handleSendEmail()}
                          disabled={sendingEmail || !emailTo || !emailSubject || !emailBody}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {sendingEmail ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send Email</>}
                        </button>
                      </div>
                    )}

                    {/* Log tab */}
                    {outreachTab === "log" && (
                      <div className="space-y-2">
                        {logSaved && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Interaction logged
                          </div>
                        )}
                        <select value={logType} onChange={e => setLogType(e.target.value)} className={inputCls}>
                          <option value="CALL_CONNECTED">Call — Connected</option>
                          <option value="CALL_VOICEMAIL">Call — Voicemail</option>
                          <option value="CALL_NO_ANSWER">Call — No Answer</option>
                          <option value="EMAIL_SENT">Email Sent</option>
                          <option value="EMAIL_REPLIED">Email Replied</option>
                          <option value="MEETING">Meeting</option>
                          <option value="LINKEDIN">LinkedIn Message</option>
                          <option value="OTHER">Other</option>
                        </select>
                        {logType === "OTHER" && (
                          <input type="text" placeholder="Activity type" value={logCustomType}
                            onChange={e => setLogCustomType(e.target.value)} className={inputCls} />
                        )}
                        <input type="text" placeholder="Outcome (optional)" value={logOutcome}
                          onChange={e => setLogOutcome(e.target.value)} className={inputCls} />
                        <input type="number" placeholder="Duration (minutes)" value={logDuration}
                          onChange={e => setLogDuration(e.target.value)} className={inputCls} />
                        <textarea rows={2} placeholder="Notes…" value={logNotes}
                          onChange={e => setLogNotes(e.target.value)} className={`${inputCls} resize-none`} />
                        {logError && <p className="text-[12px] text-red-400">{logError}</p>}
                        <button
                          onClick={() => void handleLogInteraction()}
                          disabled={savingLog}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingLog ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><FileText className="w-3.5 h-3.5" /> Log Interaction</>}
                        </button>
                      </div>
                    )}

                    {/* Follow-up tab */}
                    {outreachTab === "followup" && (
                      <div className="space-y-2">
                        {followupSaved && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Follow-up created
                          </div>
                        )}
                        <input type="text" placeholder="Follow-up title *" value={followupTitle}
                          onChange={e => setFollowupTitle(e.target.value)} className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={followupType} onChange={e => setFollowupType(e.target.value)} className={inputCls}>
                            <option value="call">Call</option>
                            <option value="email">Email</option>
                            <option value="meeting">Meeting</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="other">Other</option>
                          </select>
                          <select value={followupPriority} onChange={e => setFollowupPriority(e.target.value)} className={inputCls}>
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <input type="datetime-local" value={followupDueAt}
                          onChange={e => setFollowupDueAt(e.target.value)} className={inputCls} />
                        <textarea rows={2} placeholder="Notes…" value={followupNotes}
                          onChange={e => setFollowupNotes(e.target.value)} className={`${inputCls} resize-none`} />
                        {followupError && <p className="text-[12px] text-red-400">{followupError}</p>}
                        <button
                          onClick={() => void handleCreateFollowup()}
                          disabled={savingFollowup || !followupTitle.trim()}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingFollowup ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Calendar className="w-3.5 h-3.5" /> Create Follow-up</>}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Section 3: Saved Contacts ───────────────────────────────── */}
          {savedContacts.length > 0 && (
            <div>
              <button className={sectionHdrCls} onClick={() => toggleSection("contacts")}>
                <Star className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-200 flex-1">
                  Saved Contacts <span className="text-gray-500 font-normal">({savedContacts.length})</span>
                </span>
                {sectionOpen.contacts ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {sectionOpen.contacts && (
                <div className="px-4 pb-4 space-y-1">
                  {savedContacts.map(c => {
                    const isActive = c.id === outreachContactId
                    return (
                      <button
                        key={c.id || c.email}
                        onClick={() => {
                          setOutreachContactId(c.id)
                          if (c.email) setEmailTo(c.email)
                          setSectionOpen(prev => ({ ...prev, outreach: true }))
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                          isActive ? "bg-indigo-900/30 border border-indigo-800/40" : "hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isActive ? "text-indigo-300" : "text-white"}`}>{c.name}</p>
                          {c.title && <p className="text-[11px] text-gray-500">{c.title}</p>}
                          {c.email && <p className="text-[11px] text-gray-500">{c.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && (
                            <span className="text-[10px] text-indigo-400 font-medium px-1.5 py-0.5 rounded-full bg-indigo-900/30 border border-indigo-800/40">
                              Active
                            </span>
                          )}
                          <Link
                            href={`/sales/prospects/${c.prospectId}`}
                            onClick={e => e.stopPropagation()}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5"
                          >
                            CRM <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "Manufacturing", "Food & Beverage", "Warehousing & Logistics",
  "Retail", "Healthcare", "Hospitality", "Construction",
  "Property Management", "Education",
]

const COUNTRY_OPTIONS = [
  { value: "United States", label: "United States" },
  { value: "Canada",        label: "Canada" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Australia",     label: "Australia" },
  { value: "Other",         label: "Other" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesDiscoverPage() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [section, setSection] = useState<NavSection>("search")

  // ── Search form ─────────────────────────────────────────────────────────────
  const [country,       setCountry]       = useState("United States")
  const [stateProvince, setStateProvince] = useState("")
  const [industry,      setIndustry]      = useState("")
  const [empMin,        setEmpMin]        = useState("")
  const [empMax,        setEmpMax]        = useState("")
  const [locMin,        setLocMin]        = useState("")
  const [keywords,      setKeywords]      = useState("")
  const [context,       setContext]       = useState("")

  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [companies,   setCompanies]   = useState<DiscoveredCompanyBasic[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected,    setSelected]    = useState<DiscoveredCompanyBasic | null>(null)

  // ── Auto-save state ─────────────────────────────────────────────────────────
  const [currentListId,   setCurrentListId]   = useState<string | null>(null)
  const [currentListName, setCurrentListName] = useState<string>("")
  const [savingList,      setSavingList]      = useState(false)
  const [saveListError,   setSaveListError]   = useState<string | null>(null)
  const [renaming,        setRenaming]        = useState(false)
  const [renameInput,     setRenameInput]     = useState("")
  const [savingRename,    setSavingRename]    = useState(false)

  const stateLabel = country === "Canada" ? "Province" : country === "United States" ? "State" : "Region"

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchState("loading")
    setSearchError(null)
    setCompanies([])
    setSelected(null)
    setCurrentListId(null)
    setCurrentListName("")
    setSaveListError(null)

    const body: Record<string, unknown> = { country }
    if (stateProvince) body.stateProvince     = stateProvince
    if (industry)      body.industry          = industry
    if (empMin)        body.employeeCountMin   = parseInt(empMin,  10)
    if (empMax)        body.employeeCountMax   = parseInt(empMax,  10)
    if (locMin)        body.locationsMin       = parseInt(locMin,  10)
    if (keywords)      body.keywords           = keywords
    if (context)       body.additionalContext  = context

    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Search failed (${res.status})`)
      }
      const data = await res.json() as { companies: DiscoveredCompanyBasic[] }
      const found = data.companies ?? []
      setCompanies(found)
      setSearchState("done")

      // Auto-save results to a new list
      if (found.length > 0) {
        const autoName = buildAutoName({ industry, stateProvince, country, keywords })
        setSavingList(true)
        try {
          const saveRes = await fetch("/api/super-admin/crm/prospects/discover/lists", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name:           autoName,
              searchCountry:  country || null,
              searchState:    stateProvince || null,
              searchIndustry: industry || null,
              searchEmpMin:   empMin ? parseInt(empMin, 10) : null,
              searchEmpMax:   empMax ? parseInt(empMax, 10) : null,
              searchKeywords: keywords || null,
              searchContext:  context || null,
              results:        found,
            }),
          })
          if (saveRes.ok) {
            const saved = await saveRes.json() as ResearchList
            setCurrentListId(saved.id)
            setCurrentListName(saved.name)
          } else {
            const errData = await saveRes.json().catch(() => ({})) as { error?: string }
            setSaveListError(errData.error ?? `Could not save list (${saveRes.status}) — results are still shown above`)
          }
        } catch {
          setSaveListError("Could not save list — check your connection and try again")
        }
        finally { setSavingList(false) }
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed")
      setSearchState("error")
    }
  }

  async function handleRenameList() {
    if (!currentListId || !renameInput.trim()) return
    setSavingRename(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${currentListId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: renameInput.trim() }),
      })
      if (res.ok) {
        setCurrentListName(renameInput.trim())
        setRenaming(false)
        setRenameInput("")
      }
    } finally {
      setSavingRename(false)
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
  const labelCls = "block text-[11px] font-medium text-gray-400 mb-1.5"

  const navTabs: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: "search",   label: "Find Prospects",   icon: <Search className="w-3.5 h-3.5" /> },
    { id: "lists",    label: "Saved Lists",       icon: <Bookmark className="w-3.5 h-3.5" /> },
    { id: "prospects", label: "Active Prospects", icon: <Building2 className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-0 flex items-center gap-0">
        <Link href="/sales/prospects"
          className="text-gray-400 hover:text-gray-200 transition-colors p-3 mr-1 border-r border-gray-800">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        {navTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-4 text-[12px] font-medium border-b-2 transition-colors ${
              section === tab.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Find Prospects section ───────────────────────────────────────── */}
      {section === "search" && (
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left: Search form */}
          <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
            <form onSubmit={e => void handleSearch(e)} className="p-4 space-y-3">

              <div>
                <label className={labelCls}>Country</label>
                <select value={country} onChange={e => { setCountry(e.target.value); setStateProvince("") }}
                  className={inputCls}>
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {country !== "Other" && (
                <div>
                  <label className={labelCls}>{stateLabel}</label>
                  <input type="text"
                    placeholder={country === "Canada" ? "e.g. Ontario, BC" : "e.g. Texas, Midwest"}
                    value={stateProvince} onChange={e => setStateProvince(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}

              {country === "Other" && (
                <div>
                  <label className={labelCls}>Region / Location</label>
                  <input type="text" placeholder="e.g. Southeast Asia, Germany"
                    value={stateProvince} onChange={e => setStateProvince(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} className={inputCls}>
                  <option value="">Any industry</option>
                  {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Employee Count</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)}
                    className={inputCls} />
                  <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)}
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Min. Locations</label>
                <input type="number" placeholder="e.g. 3" value={locMin} onChange={e => setLocMin(e.target.value)}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Keywords</label>
                <input type="text" placeholder="e.g. warehousing, cold storage" value={keywords}
                  onChange={e => setKeywords(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Additional Context</label>
                <textarea rows={3} placeholder="Any other targeting details…" value={context}
                  onChange={e => setContext(e.target.value)}
                  className={`${inputCls} resize-none`} />
              </div>

              <button
                type="submit"
                disabled={searchState === "loading"}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {searchState === "loading"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                  : <><Search className="w-4 h-4" /> Find Prospects</>
                }
              </button>

              {searchState === "loading" && (
                <p className="text-[11px] text-gray-500 text-center">
                  Claude is finding real companies — this takes ~20 seconds
                </p>
              )}
            </form>
          </div>

          {/* Right: Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {searchState === "idle" && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <Search className="w-12 h-12 text-gray-700 mb-3" />
                <p className="text-gray-400 font-medium mb-1">Find sales prospects</p>
                <p className="text-sm text-gray-600">
                  Choose a country and fill in your criteria. Click any card to add a contact and start outreach.
                </p>
                <button
                  onClick={() => setSection("lists")}
                  className="mt-4 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Bookmark className="w-4 h-4" /> View your saved lists
                </button>
              </div>
            )}

            {searchState === "loading" && (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-gray-400 font-medium">Finding prospects…</p>
                <p className="text-sm text-gray-600 mt-1">Using Claude to find real companies</p>
              </div>
            )}

            {searchState === "error" && (
              <div className="h-full flex items-center justify-center">
                <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-6 text-center max-w-sm">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 font-medium mb-1">Search failed</p>
                  <p className="text-sm text-red-400/70">{searchError}</p>
                </div>
              </div>
            )}

            {searchState === "done" && (
              <>
                {/* Auto-save banner */}
                {(savingList || currentListId || saveListError) && (
                  <div className={`mb-4 rounded-xl px-4 py-3 border ${saveListError && !currentListId ? "bg-amber-950/30 border-amber-800/40" : "bg-gray-900 border-gray-700"}`}>
                    {savingList ? (
                      <div className="flex items-center gap-2 text-[12px] text-gray-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        Saving results to your lists…
                      </div>
                    ) : saveListError && !currentListId ? (
                      <div className="flex items-center gap-2 text-[12px] text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{saveListError}</span>
                      </div>
                    ) : currentListId && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <BookmarkCheck className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        {renaming ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              autoFocus
                              value={renameInput}
                              onChange={e => setRenameInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") void handleRenameList(); if (e.key === "Escape") { setRenaming(false); setRenameInput("") } }}
                              className="flex-1 min-w-0 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                            />
                            <button onClick={() => void handleRenameList()} disabled={savingRename}
                              className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md flex-shrink-0">
                              {savingRename ? "…" : "Save"}
                            </button>
                            <button onClick={() => { setRenaming(false); setRenameInput("") }} className="text-gray-400 hover:text-gray-200 flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-[12px] text-gray-300 flex-1">
                              Saved as <span className="font-medium text-white">{currentListName}</span>
                            </span>
                            <button
                              onClick={() => { setRenaming(true); setRenameInput(currentListName) }}
                              className="text-[11px] flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              <PenLine className="w-3 h-3" /> Rename
                            </button>
                            <button
                              onClick={() => setSection("lists")}
                              className="text-[11px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              View lists <ChevronRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-300 font-medium">
                    Found {companies.length} {companies.length === 1 ? "company" : "companies"}
                    {companies.some(c => c.crmStatus !== "none") && (
                      <span className="text-[11px] text-gray-500 ml-2 font-normal">
                        · {companies.filter(c => c.crmStatus !== "none").length} already in CRM
                      </span>
                    )}
                  </p>
                  {companies.length > 0 && (
                    <p className="text-[11px] text-gray-500">Click a card to add a contact</p>
                  )}
                </div>

                {companies.length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No companies found for this search.</p>
                    <p className="text-sm mt-1">Try broader criteria.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {companies.map(c => (
                    <CompanyCard
                      key={c.companyName}
                      company={c}
                      selected={selected?.companyName === c.companyName}
                      onClick={() => setSelected(prev => prev?.companyName === c.companyName ? null : c)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Saved Lists section ──────────────────────────────────────────── */}
      {section === "lists" && (
        <div className="flex flex-col h-[calc(100vh-57px)]">
          <SavedListsSection onRunSearch={params => {
            setCountry(params.country || "United States")
            setStateProvince(params.stateProvince || "")
            setIndustry(params.industry || "")
            setEmpMin(params.empMin || "")
            setEmpMax(params.empMax || "")
            setKeywords(params.keywords || "")
            setContext(params.context || "")
            setSection("search")
          }} />
        </div>
      )}

      {/* ── Active Prospects section ─────────────────────────────────────── */}
      {section === "prospects" && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-57px)] text-center px-8">
          <Building2 className="w-12 h-12 text-gray-700 mb-3" />
          <h2 className="text-white font-semibold mb-1">Your Active Prospects</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            Companies promoted from research lists live here. Manage outreach, track stages, and log activity.
          </p>
          <Link
            href="/sales/prospects"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Open Prospects
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[11px] text-gray-600 mt-4">
            To add a company to your prospects, open a Saved List and click &quot;Add to CRM&quot; on any card.
          </p>
        </div>
      )}

      {selected && (
        <SlideOver
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
