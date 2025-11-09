// next.config.ts

import path from "node:path";
import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  env: {
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true, // ← ESLint のエラーを無視してビルドを通す
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(__dirname, "src"),
    };

    return config;
  },
};

export default nextConfig;
