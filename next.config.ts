import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Node.js v26 breaks webpack's WasmHash inside the build worker; run in main process instead
    webpackBuildWorker: false,
  },
  webpack(config) {
    // Node.js v26: native WASM hash unavailable — fall back to pure-JS sha256
    config.output.hashFunction = "sha256"
    return config
  },
}

export default nextConfig
