// src/app/api/health/route.ts

import { NextResponse } from "next/server";

import { isMaintenanceActive } from "@/config/app/maintenance.config";
import { createApiRoute } from "@/lib/routeFactory";

// ビルド時に確定するID（next.config.ts の env で注入）
const BUILD_ID = process.env.NEXT_BUILD_ID ?? "unknown";

/**
 * アプリステータスAPI（認証不要）
 * - buildId: デプロイ検知用（ビルドごとに変わる）
 * - maintenance: メンテナンス中かどうか
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/health",
    operationType: "read",
  },
  async () => {
    // デプロイ検知のためキャッシュを無効化
    return NextResponse.json(
      { buildId: BUILD_ID, maintenance: isMaintenanceActive() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  },
);
