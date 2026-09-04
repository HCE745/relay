import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
import { Plus, MapPin } from "lucide-react"
import { LocationDialog } from "@/components/locations/location-dialog"

export default async function LocationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId

  const [locations, users] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        parent: { select: { name: true } },
        safetyContact: { select: { id: true, name: true } },
        _count: { select: { assets: true, issues: true, users: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header
        title="Locations"
        actions={
          <span className={session.isDemo ? "hidden sm:contents" : undefined}>
            <LocationDialog locations={locations} users={users}>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Location
              </button>
            </LocationDialog>
          </span>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="location-list">
          {locations.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-gray-200">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No locations added yet</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                    {loc.parent && <p className="text-xs text-gray-400 mt-0.5">Part of {loc.parent.name}</p>}
                    {(loc.city || loc.state) && (
                      <p className="text-sm text-gray-500 mt-1">{[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                  <LocationDialog locations={locations} users={users} initialData={{ ...loc, safetyContactId: loc.safetyContactId ?? null }}>
                    <button className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded border border-gray-200 hover:border-blue-300">Edit</button>
                  </LocationDialog>
                </div>
                {loc.address && <p className="text-xs text-gray-500 mb-3">{loc.address}</p>}
                {loc.safetyContact && (
                  <p className="text-xs text-gray-500 mb-2">
                    <span className="text-gray-400">Safety contact:</span> {loc.safetyContact.name}
                  </p>
                )}
                <div className="flex gap-4 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{loc._count.users}</div>
                    <div className="text-xs text-gray-400">Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{loc._count.assets}</div>
                    <div className="text-xs text-gray-400">Assets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{loc._count.issues}</div>
                    <div className="text-xs text-gray-400">Issues</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
