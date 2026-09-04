import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    // id uniquely identifies the app to Chrome — must be stable across deploys
    id: "/",
    name: "Relay — Operations Platform",
    short_name: "Relay",
    description: "Report, route, track, escalate, and resolve operational issues",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#111827",
    theme_color: "#111827",
    categories: ["business", "productivity"],
    // Static PNGs in /public — served without auth middleware (*.png excluded from matcher)
    // icon-maskable-*.png: solid #2563eb full-bleed background, bolt within 80% safe zone
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Report Issue",
        short_name: "Report",
        description: "Submit a new operational issue",
        url: "/issues/new",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "View operational dashboard",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
