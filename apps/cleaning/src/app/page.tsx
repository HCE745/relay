import { cn } from "@hce/ui/utils"

export default function Home() {
  return (
    <main className={cn("min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center")}>
      <h1 className="text-2xl font-semibold">HCE Cleaning</h1>
      <p className="text-gray-500">Cleaning ERP — scaffold. Nothing here yet.</p>
    </main>
  )
}
