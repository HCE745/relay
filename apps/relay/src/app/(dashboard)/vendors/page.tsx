import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { hasWashOrProfessional } from "@/lib/pricing"

export const dynamic = "force-dynamic"
import { Plus, Wrench, Mail, Phone } from "lucide-react"
import { VendorDialog } from "@/components/vendors/vendor-dialog"
import { VendorDeleteButton } from "@/components/vendors/vendor-delete-button"
import { Badge } from "@/components/ui/badge"

export default async function VendorsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  if (!hasWashOrProfessional(session.plan ?? "essentials", session.productLine)) {
    return (
      <div>
        <Header title="Vendors" />
        <PlanGateContent feature="vendors" />
      </div>
    )
  }

  const vendors = await prisma.vendor.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { issues: true, assets: true } } },
  })

  return (
    <div>
      <Header
        title="Vendors"
        actions={
          <VendorDialog>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </VendorDialog>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="vendor-list">
          {vendors.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-gray-200">
              <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No vendors added yet</p>
            </div>
          ) : (
            vendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                      {!vendor.isActive && <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>}
                    </div>
                    {vendor.specialty && <p className="text-xs text-blue-600 mt-0.5">{vendor.specialty}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <VendorDialog initialData={vendor}>
                      <button className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded border border-gray-200 hover:border-blue-300">Edit</button>
                    </VendorDialog>
                    <VendorDeleteButton vendorId={vendor.id} vendorName={vendor.name} />
                  </div>
                </div>
                <div className="space-y-1 mb-3">
                  {vendor.contactName && <p className="text-sm text-gray-600">{vendor.contactName}</p>}
                  {vendor.email && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Mail className="w-3.5 h-3.5" />
                      <a href={`mailto:${vendor.email}`} className="hover:text-blue-600">{vendor.email}</a>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Phone className="w-3.5 h-3.5" />
                      {vendor.phone}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{vendor._count.issues}</div>
                    <div className="text-xs text-gray-400">Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{vendor._count.assets}</div>
                    <div className="text-xs text-gray-400">Assets</div>
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
