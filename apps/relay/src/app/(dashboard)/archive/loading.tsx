import { Skeleton } from "@/components/ui/skeleton"

export default function ArchiveLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-9 w-52 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-24 hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
