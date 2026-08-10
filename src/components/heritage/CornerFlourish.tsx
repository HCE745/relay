interface Props {
  corner: "tl" | "tr" | "br" | "bl"
  size?: number
}

// SVG transforms mirror the TL quadrant design to each corner.
// TL focal point lives at (4,4) in a 28×28 viewBox.
const TRANSFORMS = {
  tl: "",
  tr: "translate(28,0) scale(-1,1)",
  br: "translate(28,28) scale(-1,-1)",
  bl: "translate(0,28) scale(1,-1)",
}

const POSITIONS: Record<string, React.CSSProperties> = {
  tl: { top: -4, left: -4 },
  tr: { top: -4, right: -4 },
  br: { bottom: -4, right: -4 },
  bl: { bottom: -4, left: -4 },
}

export function CornerFlourish({ corner, size = 28 }: Props) {
  return (
    <span
      className="heritage-only"
      aria-hidden="true"
      style={{
        position: "absolute",
        pointerEvents: "none",
        color: "var(--accent)",
        opacity: 0.55,
        zIndex: 2,
        ...POSITIONS[corner],
      }}
    >
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
      >
        <g transform={TRANSFORMS[corner]}>
          {/* Outer corner bracket */}
          <path d="M0 8 L0 0 L8 0" strokeLinecap="square" />
          {/* Primary spokes from focal (4,4) inward */}
          <line x1="4" y1="4" x2="24" y2="4" />
          <line x1="4" y1="4" x2="4" y2="24" />
          <line x1="4" y1="4" x2="18" y2="18" />
          {/* Secondary spokes — shorter, thinner */}
          <line x1="4" y1="4" x2="13" y2="7" strokeWidth="0.5" />
          <line x1="4" y1="4" x2="7" y2="13" strokeWidth="0.5" />
          {/* Tick marks at primary spoke tips */}
          <line x1="24" y1="2" x2="24" y2="6" />
          <line x1="2" y1="24" x2="6" y2="24" />
          {/* Diamond at focal point */}
          <path d="M4 1 L7 4 L4 7 L1 4 Z" fill="currentColor" fillOpacity="0.7" stroke="none" />
          {/* Dot at diagonal tip */}
          <circle cx="18" cy="18" r="1" fill="currentColor" stroke="none" />
        </g>
      </svg>
    </span>
  )
}
