"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { RelayWordmark } from "@/components/logo"

interface TocEntry {
  id: string
  text: string
  level: number
}

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

function buildToc(contentEl: HTMLElement): TocEntry[] {
  const headings = Array.from(contentEl.querySelectorAll("h2, h3"))
  return headings.map((h) => ({
    id:    h.id,
    text:  h.textContent ?? "",
    level: h.tagName === "H2" ? 2 : 3,
  }))
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [toc, setToc]           = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState("")

  useEffect(() => {
    if (!contentRef.current) return
    setToc(buildToc(contentRef.current))
  }, [])

  useEffect(() => {
    if (toc.length === 0) return
    const headingEls = toc
      .map((t) => document.getElementById(t.id))
      .filter(Boolean) as HTMLElement[]

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    headingEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [toc])

  return (
    <div className="min-h-screen bg-white">
      {/* Nav bar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/">
            <RelayWordmark height={28} />
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
          {/* TOC sidebar — desktop only */}
          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <nav className="sticky top-24">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  On this page
                </p>
                <ul className="space-y-1">
                  {toc.map((entry) => (
                    <li key={entry.id}>
                      <a
                        href={`#${entry.id}`}
                        className={`block text-sm py-0.5 transition-colors ${
                          entry.level === 3 ? "pl-4" : ""
                        } ${
                          activeId === entry.id
                            ? "text-blue-600 font-medium"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {/* Content */}
          <div className="min-w-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="mt-2 text-sm text-gray-500">Last updated: {lastUpdated}</p>
            </div>
            <div
              ref={contentRef}
              className="prose prose-gray max-w-none
                prose-headings:scroll-mt-24
                prose-h2:text-xl prose-h2:font-semibold prose-h2:text-gray-900 prose-h2:mt-10 prose-h2:mb-3
                prose-h3:text-base prose-h3:font-semibold prose-h3:text-gray-800 prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-li:text-gray-700 prose-li:leading-relaxed
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900"
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link href="/legal/terms"          className="hover:text-gray-700">Terms of Service</Link>
            <Link href="/legal/privacy"         className="hover:text-gray-700">Privacy Policy</Link>
            <Link href="/legal/ai-usage"        className="hover:text-gray-700">AI &amp; Data Usage</Link>
            <Link href="/legal/acceptable-use"  className="hover:text-gray-700">Acceptable Use</Link>
            <Link href="/legal/security"        className="hover:text-gray-700">Security</Link>
            <Link href="/legal/billing"         className="hover:text-gray-700">Billing</Link>
            <Link href="/legal/trust"           className="hover:text-gray-700">Trust Center</Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">&copy; {new Date().getFullYear()} Relay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
