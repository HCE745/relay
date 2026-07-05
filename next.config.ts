import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Node.js v26 WASM hash bug: disable build worker AND patch webpack hash function
    webpackBuildWorker: false,
  },
  webpack(config, { isServer }) {
    // Node.js v26: WasmHash not available in the process used by Next.js build.
    // Switching to pure-JS xxhash64 which webpack bundles itself.
    if (!isServer) {
      config.output = config.output ?? {}
      config.output.hashFunction = "xxhash64"
    }
    return config
  },
}

export default nextConfig
