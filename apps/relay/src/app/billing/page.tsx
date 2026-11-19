import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logout } from "@/lib/auth-actions"
import { PaymentForm } from "./payment-form"
import { Zap } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { subscriptionStatus: true, trialStartDate: true, trialEndsAt: true, name: true },
  })

  // Already active — send back to app
  if (org?.subscriptionStatus === "active") redirect("/dashboard")

  // Trial has started (page loaded before it did; now they can proceed)
  if (
    org?.subscriptionStatus === "trialing" &&
    org.trialStartDate &&
    org.trialStartDate <= new Date()
  ) redirect("/dashboard")

  // Scheduled trial: start date is still in the future
  if (
    org?.subscriptionStatus === "trialing" &&
    org.trialStartDate &&
    org.trialStartDate > new Date()
  ) {
    const startLabel = org.trialStartDate.toLocaleDateString("en-US", {
      month: "long",
      day:   "numeric",
      year:  "numeric",
    })

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Relay</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <h1 className="text-xl font-bold text-gray-900">Your trial starts on {startLabel}</h1>
            <p className="text-sm text-gray-500 mt-2">
              You&apos;re all set,{" "}
              <span className="font-medium text-gray-700">{org.name}</span>! Your Relay trial will
              begin on <span className="font-medium text-gray-700">{startLabel}</span>. You&apos;ll
              automatically have access on that date — no action needed.
            </p>
            <p className="text-sm text-gray-400 mt-4">
              Check back on {startLabel} to get started.
            </p>
          </div>

          <form action={logout} className="mt-6 text-center">
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    )
  }

  const trialEndsAt = org?.trialEndsAt?.toISOString() ?? null
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <PaymentForm
          orgName={org?.name ?? ""}
          trialEndsAt={trialEndsAt}
          publishableKey={publishableKey}
        />
      </div>
    </div>
  )
}
