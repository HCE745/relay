"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface CrmNote {
  id:              string
  noteText:        string
  createdBySAName: string
  createdAt:       string
}

interface Props {
  orgId: string
  notes: CrmNote[]
}

export function CrmNotes({ orgId, notes: initialNotes }: Props) {
  const router     = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [text, setText]   = useState("")
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/crm/notes/${orgId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ noteText: text }),
      })
      if (res.ok) {
        const { note } = await res.json() as { note: CrmNote }
        setNotes(prev => [note, ...prev])
        setText("")
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/super-admin/crm/notes/${orgId}`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ noteId: id }),
    })
    setNotes(prev => prev.filter(n => n.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a CRM note…"
          rows={2}
          className="flex-1 text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={addNote}
          disabled={saving || !text.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 self-end"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-sm text-gray-400">No CRM notes yet.</p>
        )}
        {notes.map(note => (
          <div key={note.id} className="bg-gray-50 rounded p-3 text-sm group relative">
            <p className="text-gray-800 whitespace-pre-wrap">{note.noteText}</p>
            <p className="text-xs text-gray-400 mt-1">
              {note.createdBySAName} · {new Date(note.createdAt).toLocaleDateString()}
            </p>
            <button
              onClick={() => deleteNote(note.id)}
              className="absolute top-2 right-2 text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
