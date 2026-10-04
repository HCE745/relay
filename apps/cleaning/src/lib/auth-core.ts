import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

// The staff-login credential decision, isolated from the cookie/session shell
// (no "server-only" import) so it is directly testable. Rejects inactive
// accounts, CLIENT (portal) users, and — critically — any account belonging to
// a DEMO org: demo accounts live only inside the sandbox (cln_demo) and must
// never obtain a real cln_session.

type AuthUser = { id: string; email: string; name: string; role: string; organizationId: string; packageTier: string; onboardingCompleted: boolean }
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string }

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { packageTier: true, onboardingCompletedAt: true, isDemo: true } } },
  })
  if (!user || !user.isActive) return { ok: false, error: "Invalid credentials" }
  if (user.role === "CLIENT") return { ok: false, error: "Please sign in at the customer portal" }
  if (user.organization.isDemo) return { ok: false, error: "Demo accounts are only usable inside the demo" }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return { ok: false, error: "Invalid credentials" }
  return {
    ok: true,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      organizationId: user.organizationId, packageTier: user.organization.packageTier,
      onboardingCompleted: !!user.organization.onboardingCompletedAt,
    },
  }
}
