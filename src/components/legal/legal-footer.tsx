import Link from "next/link"

export function LegalFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 hidden md:block">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
        <Link href="/legal/terms"         className="hover:text-gray-600 transition-colors">Terms</Link>
        <Link href="/legal/privacy"        className="hover:text-gray-600 transition-colors">Privacy</Link>
        <Link href="/legal/ai-usage"       className="hover:text-gray-600 transition-colors">AI &amp; Data Usage</Link>
        <Link href="/legal/security"       className="hover:text-gray-600 transition-colors">Security</Link>
        <Link href="/status"                   className="hover:text-gray-600 transition-colors">Status</Link>
        <a    href="mailto:info@getrelay.software" className="hover:text-gray-600 transition-colors">Contact</a>
      </div>
    </footer>
  )
}
