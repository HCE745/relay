"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

export function ResetPasswordClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get("token")

  const [password,        setPassword]        = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword,    setShowPassword]    = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState("")
  const [done,            setDone]            = useState(false)

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.")
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (password !== confirmPassword) { setError("Passwords do not match."); return }

    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(j.error ?? "Failed to reset password. Please request a new link.")
        return
      }
      setDone(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <RelayWordmark height={40} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Your password has been changed. Redirecting you to sign in…
              </p>
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set new password</h2>
              <p className="text-sm text-gray-500 mb-6">Choose a strong password for your Relay account.</p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={!token}
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={!token}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    placeholder="Repeat your new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !token || !password || !confirmPassword}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {submitting ? "Updating…" : "Update password"}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-400">
                Link expired?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-700">
                  Request a new one
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
