import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <Skeleton className="h-6 w-20" />
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 max-w-2xl space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
