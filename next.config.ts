// next.config.ts

import path from "node:path";
import type { NextConfig } from "next";

type ExtendedNextConfig = NextConfig & {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
};

/** @type {import('next').NextConfig} */
const nextConfig: ExtendedNextConfig = {
  env: {
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    resolveAlias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(__dirname, "src"),
    };

    return config;
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: "/__/:path*",
          destination: "https://oripa-do-d788a.web.app/__/:path*",
        },
      ],
    };
  },
};


export default nextConfig;
