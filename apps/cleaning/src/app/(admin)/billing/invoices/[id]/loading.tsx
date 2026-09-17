import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton action />
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    </div>
  )
}
