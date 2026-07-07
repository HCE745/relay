import { Skeleton } from "@/components/ui/skeleton"

function IssueRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0">
      <Skeleton className="h-4 w-4 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full shrink-0" />
      <Skeleton className="h-5 w-18 rounded-full shrink-0 hidden sm:block" />
      <Skeleton className="h-3 w-20 shrink-0 hidden md:block" />
    </div>
  )
}

export default function IssuesLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        {/* Filters bar skeleton */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="hidden md:flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
            {[120, 80, 90, 80, 100, 80].map((w, i) => (
              <Skeleton key={i} className={`h-3 w-${w / 4}`} />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => <IssueRow key={i} />)}
        </div>
      </div>
    </div>
  )
}
