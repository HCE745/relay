import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

export function GET(req: NextRequest) {
  const size = parseInt(req.nextUrl.searchParams.get("size") ?? "192", 10)
  const iconSize = Math.round(size * 0.5)
  const radius = Math.round(size * 0.18)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111827",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: Math.round(size * 0.78),
            height: Math.round(size * 0.78),
            background: "#2563eb",
            borderRadius: radius,
          }}
        >
          <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
