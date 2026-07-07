import { Skeleton } from "@/components/ui/skeleton"

function StatCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

function IssueRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
      <Skeleton className="h-4 w-4 rounded-full shrink-0" />
      <Skeleton className="h-4 flex-1 max-w-xs" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full hidden sm:block" />
      <Skeleton className="h-3 w-24 hidden md:block" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-3 md:py-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCard key={i} />)}
        </div>

        {/* Recent issues */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => <IssueRow key={i} />)}
        </div>
      </div>
    </div>
  )
}
