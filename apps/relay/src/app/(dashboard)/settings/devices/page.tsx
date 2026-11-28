import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { DevicesClient } from "./devices-client"
import Link from "next/link"
import { ChevronLeft, Plus } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DevicesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  const devices = await prisma.registeredDevice.findMany({
    where:   { organizationId: session.organizationId },
    orderBy: { registeredAt: "desc" },
    select: {
      id: true, deviceName: true, loginMode: true, permittedMethods: true,
      platform: true, isActive: true, registeredAt: true, lastSeenAt: true,
      revokedAt: true,
      inactivityTimeoutSeconds: true, maxSessionDurationSeconds: true,
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  // Serialize Dates → strings and cast JSON → string[] for the client component
  const serializedDevices = devices.map(d => ({
    ...d,
    permittedMethods: (d.permittedMethods ?? []) as string[],
    registeredAt: d.registeredAt.toISOString(),
    lastSeenAt:   d.lastSeenAt?.toISOString() ?? null,
    revokedAt:    d.revokedAt?.toISOString()  ?? null,
  }))

  return (
    <div>
      <Header title="Registered Devices" />
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-4 h-4" />
            Back to Settings
          </Link>
          <Link
            href="/register-device"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register This Device
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Registered Devices</h2>
          <p className="text-xs text-gray-400 mb-6">
            Devices registered as kiosks. Each device has a persistent identity credential stored in a secure cookie. Revoking a device immediately ends all active employee sessions on it.
          </p>
          <DevicesClient devices={serializedDevices} />
        </div>
      </div>
    </div>
  )
}
