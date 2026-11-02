// Original engraving-tradition ornaments, drawn as inline SVG (no images, no
// dependencies). Each is wrapped in .cln-engrave, so it is DISPLAY:NONE unless
// the Victorian theme is active — the default look is never touched. Color comes
// from the --rule token via currentColor. Decorative only: aria-hidden.

/** A central lozenge flanked by tapering hairlines — a section divider. */
export function EngravedDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`cln-engrave my-6 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 text-[color:var(--rule)]">
        <span className="h-px flex-1 bg-current" />
        <svg width="46" height="10" viewBox="0 0 46 10" fill="none" className="shrink-0">
          <path d="M23 1 L29 5 L23 9 L17 5 Z" stroke="currentColor" strokeWidth="1" />
          <path d="M23 3.2 L25.4 5 L23 6.8 L20.6 5 Z" fill="currentColor" opacity="0.5" />
          <circle cx="9" cy="5" r="1" fill="currentColor" />
          <circle cx="37" cy="5" r="1" fill="currentColor" />
          <path d="M0 5 H13 M33 5 H46" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span className="h-px flex-1 bg-current" />
      </div>
    </div>
  )
}

/** A slim engraved ribbon for a major page header: a double hairline with a
    centered cartouche. Sits UNDER a title, never over data. */
export function HeaderCartouche({ className = "" }: { className?: string }) {
  return (
    <div className={`cln-engrave mt-3 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 text-[color:var(--rule)]">
        <span className="relative h-[3px] flex-1">
          <span className="absolute inset-x-0 top-0 h-px bg-current" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-current opacity-60" />
        </span>
        <svg width="64" height="12" viewBox="0 0 64 12" fill="none" className="shrink-0">
          <path d="M32 1 L39 6 L32 11 L25 6 Z" stroke="currentColor" strokeWidth="1" />
          <circle cx="32" cy="6" r="1.4" fill="currentColor" />
          <path d="M6 6 H22 M42 6 H58" stroke="currentColor" strokeWidth="1" />
          <path d="M2 3.5 L5 6 L2 8.5" stroke="currentColor" strokeWidth="1" fill="none" />
          <path d="M62 3.5 L59 6 L62 8.5" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
        <span className="relative h-[3px] flex-1">
          <span className="absolute inset-x-0 top-0 h-px bg-current" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-current opacity-60" />
        </span>
      </div>
    </div>
  )
}
