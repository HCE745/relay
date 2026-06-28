import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function VendorsPage() {
  const { tenantId, entityId } = await getEntityContext()
  const vendors = await prisma.vendor.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { bills: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Link href="/vendors/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Vendor
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Terms</th><th>Tax ID</th><th>Bills</th></tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No vendors yet</td></tr>
            )}
            {vendors.map((v) => (
              <tr key={v.id}>
                <td className="font-medium">{v.name}</td>
                <td className="text-gray-500">{v.email ?? "—"}</td>
                <td>{v.paymentTerms}</td>
                <td className="font-mono text-xs text-gray-400">{v.taxId ?? "—"}</td>
                <td>{v._count.bills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
