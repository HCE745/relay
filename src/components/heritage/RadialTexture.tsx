// 24 hairline spokes at 15° intervals radiating from center.
// Renders as a faint texture behind hero KPI numbers.
// Invisible in Contemporary via heritage-only CSS class.
export function RadialTexture() {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 15 * Math.PI) / 180
    return (
      <line
        key={i}
        x1="100"
        y1="100"
        x2={(100 + 88 * Math.cos(angle)).toFixed(2)}
        y2={(100 + 88 * Math.sin(angle)).toFixed(2)}
      />
    )
  })

  return (
    <span
      className="heritage-only"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        style={{ color: "var(--accent)", opacity: 0.13 }}
      >
        {spokes}
      </svg>
    </span>
  )
}
