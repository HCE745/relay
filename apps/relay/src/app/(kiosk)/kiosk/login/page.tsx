"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Camera, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { CameraScanner } from "@/components/scanner/camera-scanner"
import { scannerBus } from "@/lib/scanner-bus"
import { initNativeScannerBridge } from "@/lib/native-scanner-bridge"

// Quick Access kiosk login page.
//
// A single alphanumeric input + scan button. No employee selection, no email,
// no PIN pad. The credential submitted is an Employee ID, access code, or badge value.
//
// Organization is resolved from the relay-device cookie (registered devices auto-resolve).
// If no cookie is present, a session storage slug (set by redirect logic) is used as fallback.
//
// After successful login, redirects to /kiosk/dashboard (or ?next= param).
// Admin access: an admin's email+password login from /login stays on the standard login page.
export default function KioskLoginPage() {
  const router = useRouter()

  const [credential, setCredential] = useState("")
  const [scanning,   setScanning]   = useState(false)
  const [submitting, setSubmitting]  = useState(false)
  const [error,      setError]       = useState<string | null>(null)
  const [orgSlug,    setOrgSlug]     = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize native scanner bridge (Zebra, Honeywell, Datalogic, etc.)
  useEffect(() => {
    void initNativeScannerBridge()
  }, [])

  // Resolve org slug from session storage (set when redirecting from standard login)
  useEffect(() => {
    try {
      const slug = sessionStorage.getItem("kiosk-org-slug")
      if (slug) setOrgSlug(slug)
    } catch { /* sessionStorage unavailable */ }
  }, [])

  // Register a ScannerBus handler for hardware wedge scans
  useEffect(() => {
    const unregister = scannerBus?.register((event) => {
      setCredential(event.value)
      void submit(event.value)
      return true
    })
    return () => unregister?.()
  }, [orgSlug])  // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async (value?: string) => {
    const cred = (value ?? credential).trim()
    if (!cred) return

    setSubmitting(true)
    setError(null)

    try {
      const body: Record<string, string> = { credential: cred }
      if (orgSlug) body.organizationSlug = orgSlug

      const res = await fetch("/api/auth/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Invalid credentials")
        setCredential("")
        inputRef.current?.focus()
        return
      }

      // Successful login — navigate to kiosk dashboard
      const next = new URLSearchParams(window.location.search).get("next")
      router.replace(next ?? "/kiosk/dashboard")
    } catch {
      setError("Connection error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [credential, orgSlug, router])

  function handleScan(value: string) {
    setScanning(false)
    setCredential(value)
    void submit(value)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Quick Access</h1>
          <p className="text-sm text-gray-400">Enter your credential to sign in</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl flex items-center gap-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Camera scanner */}
        {scanning && (
          <div className="mb-4">
            <CameraScanner
              onScan={handleScan}
              active={scanning}
              className="w-full aspect-square rounded-xl"
            />
            <button
              onClick={() => setScanning(false)}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-xl text-sm hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to manual entry
            </button>
          </div>
        )}

        {!scanning && (
          <form
            onSubmit={e => { e.preventDefault(); void submit() }}
            className="space-y-3"
          >
            {/* Credential input */}
            <div>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={credential}
                onChange={e => { setCredential(e.target.value); setError(null) }}
                placeholder="Employee ID or access code"
                autoFocus
                className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white text-lg text-center tracking-widest placeholder:text-gray-500 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={submitting || !credential.trim()}
              className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
                : "Sign In"
              }
            </button>

            {/* Scan button */}
            <button
              type="button"
              onClick={() => { setScanning(true); setError(null) }}
              className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Scan QR or Barcode
            </button>
          </form>
        )}

        {/* Admin access note */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Admin?{" "}
          <a href="/login" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">
            Sign in with email
          </a>
        </p>
      </div>
    </div>
  )
}
