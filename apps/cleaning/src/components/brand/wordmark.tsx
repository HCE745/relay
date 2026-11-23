import { BRAND } from "@/lib/brand"

// Temporary CleanWare wordmark. Server-safe (no "use client"). A clean,
// dependency-free mark + name that reads on both dark rails and light headers.
//
// FINAL LOGO SWAP: when the real CleanWare logo is chosen, drop it at
// /public/brand/logo.svg and set `hasLogo = true`. The <Wordmark> then renders
// the image instead of the placeholder mark; nothing else in the app changes.
const hasLogo = false

type Tone = "onDark" | "onLight"

const MARK_TONE: Record<Tone, string> = {
  onDark: "bg-brand text-white",
  onLight: "bg-brand-700 text-white",
}
const TEXT_TONE: Record<Tone, string> = {
  onDark: "text-white",
  onLight: "text-slate-900",
}

/** The placeholder glyph: a rounded square with a cleaning "spark" + initial. */
function Mark({ tone, size }: { tone: Tone; size: number }) {
  if (hasLogo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/logo.svg" alt={BRAND.name} width={size} height={size} className="shrink-0 rounded-lg" />
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold ${MARK_TONE[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {BRAND.initial}
    </span>
  )
}

export function Wordmark({
  tone = "onLight",
  size = 32,
  showName = true,
  className = "",
}: {
  tone?: Tone
  size?: number
  showName?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark tone={tone} size={size} />
      {showName ? (
        <span className={`cln-display font-semibold tracking-tight ${TEXT_TONE[tone]}`} style={{ fontSize: Math.max(14, size * 0.55) }}>
          {BRAND.name}
        </span>
      ) : null}
    </span>
  )
}
