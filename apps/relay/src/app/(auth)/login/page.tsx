"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { login } from "@/lib/auth-actions"
import { Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

const REMEMBER_KEY = "relay-remembered-email"

type View = "login" | "forgot" | "forgot-sent" | "forgot-username" | "forgot-username-sent"

export default function LoginPage() {
  const [view,           setView]           = useState<View>("login")
  const [error,          setError]          = useState("")
  const [loading,        setLoading]        = useState(false)
  const [showPassword,   setShowPassword]   = useState(false)
  const [rememberedEmail, setRememberedEmail] = useState("")
  const [rememberMe,     setRememberMe]     = useState(false)
  const [forgotEmail,    setForgotEmail]    = useState("")
  const [forgotLoading,  setForgotLoading]  = useState(false)
  const [forgotError,    setForgotError]    = useState("")
  const [lookupName,     setLookupName]     = useState("")
  const [lookupCompany,  setLookupCompany]  = useState("")
  const [lookupLoading,  setLookupLoading]  = useState(false)
  const [lookupError,    setLookupError]    = useState("")

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY) ?? ""
    if (saved) {
      setRememberedEmail(saved)
      setRememberMe(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = e.currentTarget
    const formData = new FormData(form)
    const email = formData.get("email") as string
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, email)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleLookupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!lookupName.trim() || !lookupCompany.trim()) return
    setLookupLoading(true)
    setLookupError("")
    try {
      const res = await fetch("/api/auth/forgot-username", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: lookupName.trim(), companyName: lookupCompany.trim() }),
      })
      if (!res.ok) {
        setLookupError("Something went wrong. Please try again.")
      } else {
        setView("forgot-username-sent")
      }
    } catch {
      setLookupError("Network error. Please try again.")
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleForgotSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    setForgotError("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      if (!res.ok) {
        setForgotError("Something went wrong. Please try again.")
      } else {
        setView("forgot-sent")
      }
    } catch {
      setForgotError("Network error. Please try again.")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <RelayWordmark height={40} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {/* ── Login form ── */}
          {view === "login" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-gray-500 mb-6">Sign in to your account</p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    key={rememberedEmail}
                    name="email"
                    type="email"
                    required
                    defaultValue={rememberedEmail}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(rememberedEmail); setView("forgot") }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="text-sm text-gray-600 cursor-pointer select-none">
                    Remember me
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  Get started with Relay
                </Link>
              </p>
              <p className="mt-3 text-center text-xs text-gray-400">
                Don&apos;t know your login email?{" "}
                <button
                  type="button"
                  onClick={() => setView("forgot-username")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Look it up
                </button>
              </p>
              <p className="mt-3 text-center text-xs text-gray-400">
                Evaluating Relay?{" "}
                <Link href="/book-demo" className="text-blue-600 hover:text-blue-700 font-medium">
                  Schedule a demo
                </Link>
              </p>
            </>
          )}

          {/* ── Forgot password form ── */}
          {view === "forgot" && (
            <>
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we&apos;ll send you a reset link if an account exists.
              </p>

              {forgotError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@company.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {forgotLoading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot username (look up login email) ── */}
          {view === "forgot-username" && (
            <>
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Look up your login email</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your name and company name and we&apos;ll email the address on file.
              </p>

              {lookupError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {lookupError}
                </div>
              )}

              <form onSubmit={handleLookupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your full name</label>
                  <input
                    type="text"
                    required
                    value={lookupName}
                    onChange={e => setLookupName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                  <input
                    type="text"
                    required
                    value={lookupCompany}
                    onChange={e => setLookupCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Corp"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading || !lookupName.trim() || !lookupCompany.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {lookupLoading ? "Looking up…" : "Send my login email"}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot username sent ── */}
          {view === "forgot-username-sent" && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If we found an account matching <strong>{lookupName}</strong> at{" "}
                <strong>{lookupCompany}</strong>, we&apos;ve sent the login email to the address on file.
              </p>
              <button
                onClick={() => setView("login")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* ── Forgot password sent ── */}
          {view === "forgot-sent" && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for <strong>{forgotEmail}</strong>, we&apos;ve sent a password reset link.
                Check your spam folder if you don&apos;t see it within a few minutes.
              </p>
              <button
                onClick={() => setView("login")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to sign in
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
