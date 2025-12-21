// next.config.ts

import path from "node:path";
import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  env: {
  },
  output: "standalone",
  serverExternalPackages: ["firebase-admin"],
  images: {
    unoptimized: true,
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
