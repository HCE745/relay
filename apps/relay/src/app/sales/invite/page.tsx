"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"

type Status = "loading" | "ready" | "submitting" | "done" | "error"

export default function SalesInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    }>
      <SalesInviteContent />
    </Suspense>
  )
}

function SalesInviteContent() {
  const params  = useSearchParams()
  const router  = useRouter()
  const token   = params.get("token") ?? ""

  const [status,   setStatus]   = useState<Status>("loading")
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [errMsg,   setErrMsg]   = useState("")

  // Validate the token on mount
  useEffect(() => {
    if (!token) { setStatus("error"); setErrMsg("No invitation token found. Check the link in your email."); return }

    void fetch(`/api/sales/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ name?: string; email?: string; error?: string }>)
      .then(data => {
        if (data.error) { setStatus("error"); setErrMsg(data.error); return }
        setName(data.name ?? ""); setEmail(data.email ?? ""); setStatus("ready")
      })
      .catch(() => { setStatus("error"); setErrMsg("Could not validate your invitation. Please try again.") })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg("")
    if (password.length < 8) { setErrMsg("Password must be at least 8 characters"); return }
    if (password !== confirm) { setErrMsg("Passwords do not match"); return }

    setStatus("submitting")
    try {
      const res = await fetch("/api/sales/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password, confirmPassword: confirm }),
      })
      const data = await res.json() as { ok?: boolean; email?: string; error?: string }
      if (!res.ok) { setStatus("ready"); setErrMsg(data.error ?? "Something went wrong"); return }
      setStatus("done")
      setTimeout(() => router.push("/sales/login"), 2500)
    } catch {
      setStatus("ready"); setErrMsg("Network error — please try again")
    }
  }

  // ── Strength indicator ──────────────────────────────────────────────────────
  const strength = password.length === 0 ? null
    : password.length < 8  ? "weak"
    : password.length < 12 ? "fair"
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? "strong" : "good"

  const strengthColor: Record<string, string> = {
    weak: "bg-red-500", fair: "bg-amber-400", good: "bg-emerald-400", strong: "bg-emerald-500",
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="text-white font-bold text-2xl tracking-tight">Relay</span>
          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase">
            Sales
          </span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-8 shadow-2xl">

          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm">Validating your invitation…</p>
            </div>
          )}

          {/* Error (expired / already used / invalid) */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-white font-semibold">Invitation problem</p>
              <p className="text-sm text-gray-400">{errMsg}</p>
              <p className="text-xs text-gray-600 mt-2">Ask your administrator to resend the invitation from the Sales Users settings page.</p>
            </div>
          )}

          {/* Done */}
          {status === "done" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="text-white font-semibold">Password set successfully</p>
              <p className="text-sm text-gray-400">Redirecting you to the sign-in page…</p>
            </div>
          )}

          {/* Form */}
          {(status === "ready" || status === "submitting") && (
            <>
              <h1 className="text-lg font-bold text-white mb-1">Set your password</h1>
              <p className="text-sm text-gray-500 mb-6">
                Welcome, <span className="text-gray-300 font-medium">{name}</span>. Choose a password to activate your account.
              </p>

              {errMsg && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errMsg}
                </div>
              )}

              <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {strength && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {["weak","fair","good","strong"].map((s, i) => (
                          <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              ["weak","fair","good","strong"].indexOf(strength) >= i
                                ? strengthColor[strength]
                                : "bg-gray-700"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-500 capitalize">{strength}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    className={`w-full px-3.5 py-2.5 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      confirm && confirm !== password ? "border-red-700" : "border-gray-700"
                    }`}
                  />
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting" || !password || password !== confirm}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {status === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "submitting" ? "Activating account…" : "Activate my account"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-5">
          Already have an account?{" "}
          <a href="/sales/login" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">Sign in</a>
        </p>
      </div>
    </div>
  )
}
