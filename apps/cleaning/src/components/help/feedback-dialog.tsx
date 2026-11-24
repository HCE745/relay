"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Report-a-Bug / Request-a-Feature dialog with IN-BROWSER capture:
//  • Screenshot — one frame grabbed from a getDisplayMedia share (user picks what
//    to share; nothing is captured silently).
//  • Screen recording — MediaRecorder over a getDisplayMedia stream, with
//    start / stop / preview / attach.
//  • Upload — existing images/videos as a fallback.
// Visual evidence requires an explicit consent checkbox before capture AND
// before submit. When the browser lacks getDisplayMedia we hide capture and
// explain the limitation, leaving upload as the fallback.

type Kind = "SCREENSHOT" | "RECORDING" | "UPLOAD"
type Attachment = { id: string; kind: Kind; blob: Blob; url: string; contentType: string; name: string; sizeBytes: number }

const FIELD_NAME: Record<Kind, string> = { SCREENSHOT: "screenshot", RECORDING: "recording", UPLOAD: "upload" }
const MAX_RECORDING = 25 * 1024 * 1024

function uid() {
  return Math.random().toString(36).slice(2)
}
function fmtSize(n: number) {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function supportsCapture() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined"
}

export function FeedbackDialog({ mode, onClose }: { mode: "BUG" | "FEATURE"; onClose: () => void }) {
  const isBug = mode === "BUG"
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [consent, setConsent] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState<"" | "shot" | "submit">("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const canCapture = supportsCapture()

  // Revoke object URLs on unmount.
  useEffect(() => () => { attachments.forEach((a) => URL.revokeObjectURL(a.url)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addAttachment = useCallback((kind: Kind, blob: Blob, name: string) => {
    setAttachments((prev) => [...prev, { id: uid(), kind, blob, url: URL.createObjectURL(blob), contentType: blob.type || "application/octet-stream", name, sizeBytes: blob.size }])
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const requireConsent = () => {
    if (!consent) { setError("Please confirm consent (below) before capturing your screen."); return false }
    setError(null); return true
  }

  // One-frame screenshot from a chosen screen/window/tab.
  async function captureScreenshot() {
    if (!requireConsent()) return
    setBusy("shot"); setInfo(null)
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const video = document.createElement("video")
      video.srcObject = stream
      await video.play()
      await new Promise((r) => setTimeout(r, 250)) // let a frame render
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"))
      if (blob) addAttachment("SCREENSHOT", blob, `screenshot-${Date.now()}.png`)
    } catch (e) {
      // A cancelled picker is not an error the user needs scolding for.
      if ((e as DOMException)?.name === "NotAllowedError") setInfo("Screen capture was cancelled.")
      else setError("Couldn't capture the screen. You can upload a screenshot instead.")
    } finally {
      stream?.getTracks().forEach((t) => t.stop())
      setBusy("")
    }
  }

  async function startRecording() {
    if (!requireConsent()) return
    setInfo(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setRecording(false)
        if (blob.size > MAX_RECORDING) { setError(`Recording is ${fmtSize(blob.size)} — over the 25 MB limit. Record a shorter clip.`); return }
        addAttachment("RECORDING", blob, `recording-${Date.now()}.webm`)
      }
      // If the user stops sharing via the browser's own control, end cleanly.
      stream.getVideoTracks()[0].addEventListener("ended", () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop() })
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch (e) {
      if ((e as DOMException)?.name === "NotAllowedError") setInfo("Screen recording was cancelled.")
      else setError("Couldn't start recording. You can upload a recording instead.")
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (!list) return
    for (const f of Array.from(list)) {
      if (!/^image\/|^video\//.test(f.type)) { setError(`${f.name}: only images and videos are allowed`); continue }
      addAttachment("UPLOAD", f, f.name)
    }
    e.target.value = ""
  }

  async function submit() {
    if (!title.trim()) { setError("Add a short title."); return }
    if (!description.trim()) { setError("Add a description."); return }
    if (attachments.length > 0 && !consent) { setError("Confirm consent before submitting visual evidence."); return }
    setBusy("submit"); setError(null)
    try {
      const fd = new FormData()
      fd.set("type", mode)
      fd.set("title", title.trim())
      fd.set("description", description.trim())
      fd.set("consent", consent ? "1" : "0")
      fd.set("pageUrl", typeof window !== "undefined" ? window.location.pathname + window.location.search : "")
      for (const a of attachments) fd.append(FIELD_NAME[a.kind], new File([a.blob], a.name, { type: a.contentType }))
      const res = await fetch("/api/feedback", { method: "POST", body: fd })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string; details?: string } | null
        throw new Error(data?.details || data?.error || `Submit failed (${res.status})`)
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit. Please try again.")
    } finally {
      setBusy("")
    }
  }

  return (
    // The overlay itself scrolls (min-h-full + items-center) so a tall dialog is
    // never clipped at the top of the viewport; the body scrolls internally too.
    <div className="fixed inset-0 z-[9500] overflow-y-auto bg-slate-900/50" onClick={onClose}>
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{isBug ? "Report a bug" : "Request a feature"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Thanks — we got it</h3>
            <p className="mt-1 text-sm text-slate-500">Your {isBug ? "bug report" : "feature request"} was sent to the team.</p>
            <button onClick={onClose} className="mt-5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Done</button>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
                placeholder={isBug ? "e.g. Invoice total shows wrong tax" : "e.g. Bulk-assign cleaners to a route"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{isBug ? "What happened?" : "What would help?"}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000}
                placeholder={isBug ? "Steps to reproduce, what you expected, what happened instead." : "Describe the workflow you'd like to be faster or possible."}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>

            {isBug ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">Attach visual evidence (optional)</div>
                {canCapture ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={captureScreenshot} disabled={!!busy || recording}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {busy === "shot" ? "Capturing…" : "📸 Capture screenshot"}
                    </button>
                    {recording ? (
                      <button type="button" onClick={stopRecording}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Stop recording
                      </button>
                    ) : (
                      <button type="button" onClick={startRecording} disabled={!!busy}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        🎥 Record screen
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mb-2 text-xs text-amber-700">
                    Your browser doesn’t support in-app screen capture. You can still upload a screenshot or recording below.
                  </p>
                )}
                <label className="mt-2 inline-block cursor-pointer text-xs font-medium text-brand-700 hover:text-brand-800">
                  ⬆ Upload an image or video
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickFiles} />
                </label>
              </div>
            ) : (
              <label className="inline-block cursor-pointer text-xs font-medium text-brand-700 hover:text-brand-800">
                ⬆ Attach a mockup or screenshot (optional)
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickFiles} />
              </label>
            )}

            {attachments.length > 0 ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-600">Review attachments ({attachments.length})</div>
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {a.contentType.startsWith("video/") ? (
                        <video src={a.url} controls className="h-28 w-full bg-black object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.name} className="h-28 w-full object-contain" />
                      )}
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-500">
                        <span className="truncate">{a.kind.toLowerCase()} · {fmtSize(a.sizeBytes)}</span>
                        <button onClick={() => removeAttachment(a.id)} className="font-semibold text-red-600 hover:text-red-700">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>I understand screenshots/recordings may show on-screen data, and I consent to attaching and submitting them for support. Avoid capturing passwords or sensitive personal data.</span>
            </label>

            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
            {info ? <p className="text-xs text-slate-500">{info}</p> : null}
          </div>
        )}

        {!done ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={submit} disabled={busy === "submit"}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {busy === "submit" ? "Sending…" : isBug ? "Send bug report" : "Send request"}
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}
