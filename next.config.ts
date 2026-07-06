import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Node.js v26 WASM hash bug: disable build worker AND patch webpack hash function
    webpackBuildWorker: false,
  },
  webpack(config, { isServer }) {
    // Node.js v26: WasmHash crashes in BatchedHash.update with undefined.
    // Apply xxhash64 to both builds when webpackBuildWorker is disabled
    // (both compile in the same process, both need the pure-JS fallback).
    config.output = config.output ?? {}
    config.output.hashFunction = "xxhash64"
    return config
  },
}

export default nextConfig
