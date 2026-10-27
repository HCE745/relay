"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Author/publish actions (OWNER/ADMIN/MANAGER). Publishing an immutable version;
// revising a published SOP opens a fresh draft to edit.
export function SopAdminActions({ sopId, hasDraft, isPublished, isArchived }: { sopId: string; hasDraft: boolean; isPublished: boolean; isArchived: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function post(action: string, then?: () => void) {
    setBusy(true)
    const res = await apiSend(`/api/sops/${sopId}/${action}`, "POST")
    setBusy(false)
    if (!res.ok) { alert(res.error); return }
    if (then) then(); else router.refresh()
  }
  return (
    <div className="flex flex-wrap gap-2">
      {hasDraft ? <Button size="sm" variant="secondary" onClick={() => router.push(`/sops/${sopId}/edit`)}>Edit draft</Button> : null}
      {hasDraft ? <Button size="sm" onClick={() => post("publish")} disabled={busy}>Publish</Button> : null}
      {!hasDraft && isPublished ? <Button size="sm" onClick={() => post("revise", () => router.push(`/sops/${sopId}/edit`))} disabled={busy}>Revise (new version)</Button> : null}
      {!isArchived ? <Button size="sm" variant="ghost" onClick={() => { if (confirm("Archive this SOP? It will no longer appear to staff.")) post("archive") }} disabled={busy}>Archive</Button> : null}
    </div>
  )
}
