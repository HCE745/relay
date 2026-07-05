import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    config.output = config.output ?? {}
    // Node.js v22+ breaks webpack's WasmHash; fall back to sha256
    config.output.hashFunction = "sha256"
    return config
  },
}

export default nextConfig
