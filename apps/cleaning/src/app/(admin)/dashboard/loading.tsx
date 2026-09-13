import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-8">
        <CardGridSkeleton count={6} />
      </div>
      <CardGridSkeleton count={3} />
    </div>
  )
}
