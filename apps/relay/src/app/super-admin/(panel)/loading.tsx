import { Skeleton } from "@/components/ui/skeleton"

export default function SuperAdminLoading() {
  return (
    <div className="p-4 md:p-8">
      <Skeleton className="h-7 w-40 mb-2 bg-gray-800" />
      <Skeleton className="h-4 w-24 mb-6 bg-gray-800" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <Skeleton className="h-3 w-20 mb-3 bg-gray-800" />
            <Skeleton className="h-7 w-12 mb-1 bg-gray-800" />
            <Skeleton className="h-3 w-24 bg-gray-800" />
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-800 last:border-0">
            <Skeleton className="h-4 flex-1 max-w-xs bg-gray-800" />
            <Skeleton className="h-5 w-16 rounded-full bg-gray-800" />
            <Skeleton className="h-3 w-24 bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
