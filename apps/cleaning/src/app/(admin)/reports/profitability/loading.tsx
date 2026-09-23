import { PageHeaderSkeleton, CardGridSkeleton, TableSkeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={5} cols={6} />
    </div>
  )
}
