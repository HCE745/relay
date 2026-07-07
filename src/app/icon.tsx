import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          borderRadius: 6,
        }}
      >
        <svg viewBox="1.75 0 48 48" width={22} height={22} fill="none">
          <path d="M16 9 V39" stroke="white" strokeWidth="8" strokeLinecap="round" />
          <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 33.5 L32 39 L26.5 39" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
