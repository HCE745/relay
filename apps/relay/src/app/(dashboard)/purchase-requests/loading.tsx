import { Skeleton } from "@/components/ui/skeleton"

export default function PurchaseRequestsLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
              <Skeleton className="h-4 w-16 hidden md:block" />
              <Skeleton className="h-3 w-20 hidden lg:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
