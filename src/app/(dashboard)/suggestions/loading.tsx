import { Skeleton } from "@/components/ui/skeleton"

export default function SuggestionsLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Submit form skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Inbox skeleton */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-gray-100 last:border-0 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
