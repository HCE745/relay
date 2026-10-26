import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton"

// Matches the operations view shape: header, week strip, timeline + exceptions,
// then the secondary metric tiles.
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <CardGridSkeleton count={8} />
    </div>
  )
}
