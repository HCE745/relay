// Original engraving-tradition ornaments, drawn as inline SVG (no images, no
// dependencies). Each is wrapped in .cln-engrave, so it is DISPLAY:NONE unless
// the Victorian theme is active — the default look is never touched. Color comes
// from the --rule token via currentColor. Decorative only: aria-hidden.
//
// Motif vocabulary (shared by both pieces, in the commercial-engraving tradition
// — original, not traced from any source): a central lozenge cartouche with an
// inset diamond and a pointille centre, flanked by C-scroll fleurons, carried on
// hairline rules that terminate in open arrowhead darts.

const STROKE = {
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
}

/** A slim engraved ribbon for a major page header: a ruled banner with a central
    lozenge cartouche, scroll fleurons and arrowhead terminals. Sits UNDER a
    title, never over data. The full-width hairlines are the flanking flex spans. */
export function HeaderCartouche({ className = "" }: { className?: string }) {
  return (
    <div className={`cln-engrave mt-3 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 text-[color:var(--rule)]">
        <span className="relative h-[3px] flex-1">
          <span className="absolute inset-x-0 top-0 h-px bg-current" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-current opacity-60" />
        </span>
        <svg width="200" height="20" viewBox="0 0 200 20" className="shrink-0">
          {/* left dart + rule */}
          <path d="M22 5 L8 10 L22 15" {...STROKE} />
          <path d="M22 10 H70" {...STROKE} />
          {/* left C-scroll fleuron */}
          <path d="M70 10 C 64 10 62 5.5 57 6.5 C 53 7.3 53 10.5 57 11 C 60 11.4 61 9 59 8" {...STROKE} />
          <circle cx="58.5" cy="9" r="1" fill="currentColor" />
          {/* rule into the cartouche */}
          <path d="M70 10 H88" {...STROKE} />
          {/* central lozenge cartouche */}
          <path d="M100 3 L112 10 L100 17 L88 10 Z" {...STROKE} />
          <path d="M100 6 L106 10 L100 14 L94 10 Z" fill="currentColor" opacity="0.45" />
          <circle cx="100" cy="10" r="1.4" fill="currentColor" />
          {/* right rule + fleuron (mirror) */}
          <path d="M112 10 H130" {...STROKE} />
          <path d="M130 10 C 136 10 138 5.5 143 6.5 C 147 7.3 147 10.5 143 11 C 140 11.4 139 9 141 8" {...STROKE} />
          <circle cx="141.5" cy="9" r="1" fill="currentColor" />
          {/* right rule + dart */}
          <path d="M130 10 H178" {...STROKE} />
          <path d="M178 5 L192 10 L178 15" {...STROKE} />
        </svg>
        <span className="relative h-[3px] flex-1">
          <span className="absolute inset-x-0 top-0 h-px bg-current" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-current opacity-60" />
        </span>
      </div>
    </div>
  )
}

/** A section divider: a central rosette flanked by scroll fleurons and tapering
    hairlines that terminate in arrowhead darts. */
export function EngravedDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`cln-engrave my-6 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 text-[color:var(--rule)]">
        <span className="h-px flex-1 bg-current" />
        <svg width="140" height="14" viewBox="0 0 140 14" className="shrink-0">
          {/* end darts + rules */}
          <path d="M22 4 L14 7 L22 10" {...STROKE} />
          <path d="M22 7 H34" {...STROKE} />
          <path d="M118 4 L126 7 L118 10" {...STROKE} />
          <path d="M106 7 H118" {...STROKE} />
          {/* left fleuron */}
          <path d="M48 7 C 43 7 41 3.5 37 4.5 C 34 5.2 34 7.8 37 8.2 C 39 8.5 40 6.5 38.5 6" {...STROKE} />
          <circle cx="38" cy="6.3" r="0.9" fill="currentColor" />
          <path d="M48 7 H60" {...STROKE} />
          {/* central rosette */}
          <path d="M70 1 L78 7 L70 13 L62 7 Z" {...STROKE} />
          <path d="M70 3.5 L74 7 L70 10.5 L66 7 Z" fill="currentColor" opacity="0.45" />
          <circle cx="70" cy="7" r="1" fill="currentColor" />
          {/* right fleuron */}
          <path d="M80 7 H92" {...STROKE} />
          <path d="M92 7 C 97 7 99 3.5 103 4.5 C 106 5.2 106 7.8 103 8.2 C 101 8.5 100 6.5 101.5 6" {...STROKE} />
          <circle cx="102" cy="6.3" r="0.9" fill="currentColor" />
        </svg>
        <span className="h-px flex-1 bg-current" />
      </div>
    </div>
  )
}
