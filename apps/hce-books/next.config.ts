import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  // Pin the monorepo root so Next doesn't infer it from a stray lockfile
  // outside the repo (file tracing / bundling correctness).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Compile the workspace TypeScript packages we consume from source.
  transpilePackages: ["@hce/auth"],
  serverExternalPackages: ["pg"],
  experimental: {
    webpackBuildWorker: false,
  },
}

export default nextConfig
