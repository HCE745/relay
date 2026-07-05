import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Node.js v26 breaks webpack's WasmHash inside the build worker; run in main process instead
    webpackBuildWorker: false,
  },
}

export default nextConfig
