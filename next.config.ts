import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Node.js v26 WASM hash bug: disable build worker AND patch webpack hash function
    webpackBuildWorker: false,
  },
  webpack(config) {
    // Node.js v26: WasmHash crashes with undefined.length — use pure-JS xxhash64 for both builds.
    config.output = config.output ?? {}
    config.output.hashFunction = "xxhash64"
    return config
  },
}

export default nextConfig
