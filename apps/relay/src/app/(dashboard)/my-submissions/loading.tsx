import { Skeleton } from "@/components/ui/skeleton"

function SubmissionRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      <Skeleton className="h-3 w-20 shrink-0 hidden md:block" />
    </div>
  )
}

export default function MySubmissionsLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <Skeleton className="h-6 w-32" />
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 space-y-5">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => <SubmissionRow key={i} />)}
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => <SubmissionRow key={i} />)}
        </div>
      </div>
    </div>
  )
}
