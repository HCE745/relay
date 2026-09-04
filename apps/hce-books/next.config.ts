import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    webpackBuildWorker: false,
  },
}

export default nextConfig
