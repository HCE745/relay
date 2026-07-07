import { Skeleton } from "@/components/ui/skeleton"

export default function CalendarLoading() {
  return (
    <div>
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day header row */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2 px-1 text-center">
                <Skeleton className="h-3 w-6 mx-auto" />
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          {Array.from({ length: 5 }).map((_, week) => (
            <div key={week} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
              {Array.from({ length: 7 }).map((_, day) => (
                <div key={day} className="min-h-[80px] p-2 border-r border-gray-100 last:border-0 space-y-1.5">
                  <Skeleton className="h-3 w-4" />
                  {(week + day) % 3 === 0 && <Skeleton className="h-4 w-full rounded" />}
                  {(week + day) % 5 === 0 && <Skeleton className="h-4 w-4/5 rounded" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
