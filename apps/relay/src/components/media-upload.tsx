"use client"

import { useRef, useState } from "react"
import { Camera, Video, ImagePlus, X, Loader2, AlertCircle } from "lucide-react"

export interface UploadedFile {
  url:      string
  filename: string
  mimeType: string
  size:     number
}

interface UploadTask {
  id:    string
  name:  string
  stage: "checking" | "processing" | "uploading"
  pct:   number // 0–100 within the current stage
}

interface Props {
  value:     UploadedFile[]
  onChange:  (files: UploadedFile[]) => void
  maxFiles?: number
}

const MAX_DURATION_S = 180   // 3 minutes
const MAX_LONG_PX    = 1920  // landscape width / portrait height (longer side)
const MAX_SHORT_PX   = 1080  // landscape height / portrait width (shorter side)

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

// ─── Video metadata ──────────────────────────────────────────────────────────

function getVideoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      const { duration, videoWidth: width, videoHeight: height } = v
      URL.revokeObjectURL(v.src)
      v.src = ""
      resolve({ duration, width, height })
    }
    v.onerror = () => reject(new Error("Could not read video metadata"))
    v.src = URL.createObjectURL(file)
  })
}

// ─── Canvas + MediaRecorder transcoding ──────────────────────────────────────
// Plays the source video into an off-screen canvas at the target resolution
// and re-records via MediaRecorder. Runs at 1× speed (real-time).
// Falls back to the original file if the browser doesn't support the required APIs.

function transcodeVideo(
  file: File,
  targetW: number,
  targetH: number,
  onProgress: (pct: number) => void,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement("video")
    videoEl.muted      = true  // prevents speaker playback; AudioContext still captures audio
    videoEl.playsInline = true
    videoEl.preload    = "auto"

    videoEl.oncanplay = async () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width  = targetW
        canvas.height = targetH
        const ctx = canvas.getContext("2d")!

        // Try to capture audio through Web Audio API
        let audioTracks: MediaStreamTrack[] = []
        try {
          const audioCtx = new AudioContext()
          await audioCtx.resume()
          const src = audioCtx.createMediaElementSource(videoEl)
          const dst = audioCtx.createMediaStreamDestination()
          src.connect(dst)
          audioTracks = dst.stream.getAudioTracks()
        } catch {
          // AudioContext not available — transcode without audio
        }

        const canvasStream = canvas.captureStream(30)
        const combined = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...audioTracks,
        ])

        // Pick the best supported output format
        const mimeTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ]
        const mimeType = mimeTypes.find(t => {
          try { return MediaRecorder.isTypeSupported(t) }
          catch { return false }
        })

        if (!mimeType) {
          // Browser can't re-encode — upload original
          URL.revokeObjectURL(videoEl.src)
          resolve(file)
          return
        }

        const recorder = new MediaRecorder(combined, {
          mimeType,
          videoBitsPerSecond: 5_000_000, // 5 Mbps — good quality for 1080p
        })

        const chunks: Blob[] = []
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
          const baseMime = mimeType.split(";")[0].trim()
          const ext      = baseMime === "video/webm" ? "webm" : "mp4"
          const blob     = new Blob(chunks, { type: baseMime })
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: baseMime }))
        }

        let raf: ReturnType<typeof requestAnimationFrame>
        const draw = () => {
          if (!videoEl.paused && !videoEl.ended) {
            ctx.drawImage(videoEl, 0, 0, targetW, targetH)
            onProgress(videoEl.currentTime / videoEl.duration)
            raf = requestAnimationFrame(draw)
          }
        }

        recorder.start(250)
        await videoEl.play()
        draw()

        videoEl.onended = () => {
          cancelAnimationFrame(raf)
          recorder.stop()
          URL.revokeObjectURL(videoEl.src)
        }
      } catch (err) {
        reject(err)
      }
    }

    videoEl.onerror = () => reject(new Error("Failed to load video for processing"))
    videoEl.src = URL.createObjectURL(file)
  })
}

// ─── XHR upload with progress ─────────────────────────────────────────────────

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/attachments/upload")

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }

    xhr.onload = () => {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON */ }
      if (xhr.status >= 400) {
        reject(new Error((data.error as string | undefined) ?? `Upload failed (${xhr.status})`))
      } else {
        resolve(data as unknown as UploadedFile)
      }
    }

    xhr.onerror = () => reject(new Error("Upload failed"))
    xhr.onabort = () => reject(new Error("Upload cancelled"))
    xhr.send(form)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MediaUpload({ value, onChange, maxFiles = 10 }: Props) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [error, setError] = useState("")

  const photoRef   = useRef<HTMLInputElement>(null)
  const videoRef   = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const busy   = tasks.length > 0
  const canAdd = !busy && value.length < maxFiles

  function upsertTask(id: string, patch: Partial<UploadTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  function dropTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const slots = maxFiles - value.length  // tasks.length === 0 here (canAdd guard)
    if (slots <= 0) { setError(`Maximum ${maxFiles} files allowed`); return }
    setError("")

    const toProcess = Array.from(files).slice(0, slots)
    const completed: UploadedFile[] = []

    for (const file of toProcess) {
      const id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)

      const isVid = file.type.startsWith("video/")
      setTasks(prev => [...prev, { id, name: file.name, stage: isVid ? "checking" : "uploading", pct: 0 }])

      try {
        let fileToUpload = file

        if (isVid) {
          // ── 1. Metadata: duration + dimensions ────────────────────
          const { duration, width, height } = await getVideoMeta(file)

          if (duration > MAX_DURATION_S) {
            dropTask(id)
            setError(
              `"${file.name}" is ${formatDuration(duration)} long. ` +
              `Videos must be 3 minutes or shorter — please trim it and try again.`
            )
            continue
          }

          // ── 2. Transcode — always, to compress phone bitrate (30-60 Mbps → 5 Mbps)
          //    Also downscale if resolution exceeds 1080p. ────────────────────
          const longSide  = Math.max(width, height)
          const shortSide = Math.min(width, height)
          const needsDownscale = longSide > MAX_LONG_PX || shortSide > MAX_SHORT_PX
          const scale   = needsDownscale ? Math.min(MAX_LONG_PX / longSide, MAX_SHORT_PX / shortSide) : 1
          // Clamp to even pixel counts (required by most video codecs)
          const targetW = (Math.round(width  * scale) >> 1) << 1
          const targetH = (Math.round(height * scale) >> 1) << 1

          upsertTask(id, { stage: "processing", pct: 0 })
          try {
            fileToUpload = await transcodeVideo(file, targetW, targetH, pct =>
              upsertTask(id, { pct: Math.round(pct * 100) })
            )
          } catch (err) {
            console.warn("[media-upload] Transcoding failed:", err)
            // Only fall back to original if it's small enough to pass the server limit
            if (file.size > 4 * 1024 * 1024) {
              dropTask(id)
              setError(`"${file.name}" could not be compressed. Please try a shorter clip or use a different browser.`)
              continue
            }
          }
        }

        // ── 3. Upload ──────────────────────────────────────────────────
        upsertTask(id, { stage: "uploading", pct: 0 })
        const result = await uploadWithProgress(fileToUpload, pct =>
          upsertTask(id, { pct: Math.round(pct * 100) })
        )
        completed.push(result)
        dropTask(id)
      } catch (err: unknown) {
        dropTask(id)
        setError(err instanceof Error ? err.message : "Upload failed")
      }
    }

    if (completed.length > 0) onChange([...value, ...completed])

    if (photoRef.current)   photoRef.current.value   = ""
    if (videoRef.current)   videoRef.current.value   = ""
    if (galleryRef.current) galleryRef.current.value = ""
  }

  const currentTask = tasks[0]

  return (
    <div className="space-y-3">
      {/* Completed file thumbnails + in-progress task tiles */}
      {(value.length > 0 || tasks.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {value.map((f, i) => (
            <div key={i} className="relative group">
              {f.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/attachments/view?url=${encodeURIComponent(f.url)}`}
                  alt={f.filename}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-xs text-center px-1 gap-1">
                  <Video className="w-5 h-5" />
                  <span className="truncate w-full text-center">{f.filename.split(".").pop()?.toUpperCase()}</span>
                  <span>{formatBytes(f.size)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* In-progress tiles */}
          {tasks.map(task => (
            <div
              key={task.id}
              className="w-20 h-20 relative flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-center px-1.5 gap-0.5 overflow-hidden"
            >
              {task.stage === "checking" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mb-0.5" />
                  <span className="text-[10px] leading-tight">Checking…</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-semibold leading-tight">
                    {task.stage === "processing" ? "Compressing" : "Uploading"}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{task.pct}%</span>
                  {/* Progress bar pinned to bottom */}
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-blue-100">
                    <div
                      className="h-full bg-blue-500 transition-all duration-100"
                      style={{ width: `${task.pct}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status text while busy */}
      {busy && currentTask && (
        <p className="text-xs text-blue-600">
          {currentTask.stage === "checking"
            ? "Reading video…"
            : currentTask.stage === "processing"
            ? `Compressing video — ${currentTask.pct}% (runs in real time, please wait)`
            : `Uploading — ${currentTask.pct}%`}
        </p>
      )}

      {/* Upload buttons — hidden while busy */}
      {canAdd && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            Take photo
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={e => handleFiles(e.target.files)} />

          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
            Record video
          </button>
          <input ref={videoRef} type="file" accept="video/*" capture="environment"
            className="hidden" onChange={e => handleFiles(e.target.files)} />

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Upload file
          </button>
          <input ref={galleryRef} type="file" accept="image/*,video/*" multiple
            className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Up to {maxFiles} files · Photos max 10 MB · Videos max 3 min (auto-compressed before upload)
      </p>
    </div>
  )
}
