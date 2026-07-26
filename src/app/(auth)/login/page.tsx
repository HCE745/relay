"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Login failed")
        return
      }
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--navy)" }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="mb-8">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>HCE Books</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Internal accounting platform</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="field-input"
                placeholder="you@hce.com"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="field-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
