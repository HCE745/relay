import Link from "next/link"

export function LegalFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-100/70 bg-transparent px-6 py-2.5 hidden md:block">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-300">
        <Link href="/legal/terms"         className="hover:text-gray-500 transition-colors">Terms</Link>
        <Link href="/legal/privacy"        className="hover:text-gray-500 transition-colors">Privacy</Link>
        <Link href="/legal/ai-usage"       className="hover:text-gray-500 transition-colors">AI &amp; Data Usage</Link>
        <Link href="/legal/security"       className="hover:text-gray-500 transition-colors">Security</Link>
        <Link href="/status"                   className="hover:text-gray-500 transition-colors">Status</Link>
        <a    href="mailto:info@getrelay.software" className="hover:text-gray-500 transition-colors">Contact</a>
      </div>
    </footer>
  )
}
