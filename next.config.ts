// next.config.ts

import crypto from "node:crypto";
import path from "node:path";
import type { NextConfig } from "next";

// ビルドごとに一意なID（デプロイ検知用）
const buildId = crypto.randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  generateBuildId: () => buildId,
  env: {
    NEXT_BUILD_ID: buildId,
  },
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
    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return {
      fallback: [
        {
          // Firebase Auth handler をプロキシ
          source: "/__/:path*",
          destination: `https://${firebaseProjectId}.web.app/__/:path*`,
        },
      ],
    };
  },
};


export default nextConfig;
