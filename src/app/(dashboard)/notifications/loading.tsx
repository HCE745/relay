import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <Skeleton className="h-6 w-28" />
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4">
              <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
