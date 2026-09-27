import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-9 w-48 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-10 w-full rounded-xl" />
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  )
}
