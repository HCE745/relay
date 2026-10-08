export const dynamic = "force-dynamic"
// Public, unauthenticated shell (online booking, job applications). No app chrome.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100">{children}</div>
}
