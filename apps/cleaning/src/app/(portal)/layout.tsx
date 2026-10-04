export const dynamic = "force-dynamic"

// The customer portal shell — intentionally separate from the staff admin/field
// shells. No staff nav, no capability context; portal pages guard their own
// session.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  )
}
