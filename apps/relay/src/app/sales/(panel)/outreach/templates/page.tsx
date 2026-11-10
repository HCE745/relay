"use client"

import { useState, useEffect, useCallback } from "react"
import { FileText, Plus, X, Loader2, Edit2, Trash2, ChevronDown, ChevronUp, AlertTriangle, Shield } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Template {
  id: string
  name: string
  subject: string
  body: string
  isSystem: boolean
  updatedAt: string
}

function TemplateEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Template>
  onSave: (data: { name: string; subject: string; body: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [subject, setSubject] = useState(initial?.subject ?? "")
  const [body, setBody] = useState(initial?.body ?? "")

  return (
    <div className="space-y-3 p-4 bg-gray-800/60 rounded-xl border border-gray-700">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Template Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Cold Outreach — Manufacturing"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Quick question about {{companyName}}'s scheduling"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Body</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          placeholder={"Hi {{firstName}},\n\nI noticed {{companyName}} operates in {{city}}…"}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors resize-y font-mono"
        />
        <p className="text-[10px] text-gray-600 mt-1">
          Merge fields: <span className="text-gray-500">{"{{firstName}}"}, {"{{companyName}}"}, {"{{city}}"}, {"{{repName}}"}</span>
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onSave({ name, subject, body })}
          disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
          className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Template
        </button>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)

  const [creating, setCreating] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/templates")
      if (res.ok) {
        const d = await res.json()
        setTemplates(d.templates ?? [])
        setIsManager(d.isManager ?? false)
      } else {
        setError("Failed to load templates")
      }
    } catch {
      setError("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(data: { name: string; subject: string; body: string }) {
    setSavingNew(true)
    try {
      const res = await fetch("/api/sales/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Failed to create template")
        return
      }
      await load()
      setCreating(false)
    } finally {
      setSavingNew(false)
    }
  }

  async function handleEdit(id: string, data: { name: string; subject: string; body: string }) {
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/sales/templates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Failed to update template")
        return
      }
      await load()
      setEditingId(null)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/sales/templates/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Failed to delete template")
        return
      }
      await load()
      setConfirmDeleteId(null)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Templates</h1>
          <p className="text-gray-400 text-sm mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        </div>
        {isManager && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 mb-4 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {creating && (
        <div className="mb-4">
          <TemplateEditor
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={savingNew}
          />
        </div>
      )}

      {templates.length === 0 && !creating ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No templates yet</p>
          {isManager && (
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-emerald-500 hover:text-emerald-400"
            >
              Create your first template →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {editingId === t.id ? (
                <div className="p-4">
                  <TemplateEditor
                    initial={t}
                    onSave={data => handleEdit(t.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={savingEdit}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm truncate">{t.name}</p>
                        {t.isSystem && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700 flex items-center gap-0.5 shrink-0">
                            <Shield className="w-2.5 h-2.5" />System
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-gray-600 mr-2 hidden sm:block">
                        {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                      </span>
                      {isManager && !t.isSystem && (
                        <>
                          <button
                            onClick={() => { setEditingId(t.id); setExpandedId(null) }}
                            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === t.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-red-400">Delete?</span>
                              <button
                                onClick={() => handleDelete(t.id)}
                                disabled={deletingId === t.id}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                {deletingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px] font-medium">Yes</span>}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <span className="text-[10px]">No</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(t.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(v => v === t.id ? null : t.id)}
                        className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Preview"
                      >
                        {expandedId === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {expandedId === t.id && (
                    <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Subject:</p>
                      <p className="text-sm text-gray-200 mb-3">{t.subject}</p>
                      <p className="text-xs text-gray-500 mb-1 font-medium">Body:</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed bg-gray-800/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                        {t.body}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
