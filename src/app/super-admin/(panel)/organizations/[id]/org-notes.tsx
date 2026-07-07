"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { StickyNote, Plus, Loader2, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Note {
  id: string
  content: string
  superAdminName: string
  createdAt: string
}

interface Props {
  orgId: string
  initialNotes: Note[]
}

export function OrgNotes({ orgId, initialNotes }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function addNote() {
    if (!draft.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      })
      const json = await res.json() as Note & { error?: string }
      if (!res.ok) { setError(json.error ?? "Failed to save note"); return }
      setNotes([json, ...notes])
      setDraft("")
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(noteId: string) {
    setDeleting(noteId)
    try {
      await fetch(`/api/super-admin/organizations/${orgId}/notes`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId }),
      })
      setNotes(notes.filter((n) => n.id !== noteId))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-4 h-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Customer Notes</h2>
        {notes.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{notes.length}</span>
        )}
      </div>

      {/* Add note form */}
      <div className="mb-5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote() }}
          placeholder="Add a note about this customer (special deals, support history, reminders…)"
          rows={3}
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          {error ? <p className="text-red-400 text-xs">{error}</p> : <span className="text-gray-600 text-xs">⌘↵ to submit</span>}
          <button
            onClick={addNote}
            disabled={!draft.trim() || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-800 rounded-lg p-3.5 group">
              <div className="flex items-start justify-between gap-3">
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
                <button
                  onClick={() => deleteNote(note.id)}
                  disabled={deleting === note.id}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0 mt-0.5"
                  title="Delete note"
                >
                  {deleting === note.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-indigo-400 font-medium">{note.superAdminName}</span>
                <span className="text-gray-600 text-xs">·</span>
                <span className="text-gray-500 text-xs">
                  {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
