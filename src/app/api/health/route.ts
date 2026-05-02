// src/app/api/health/route.ts

import { NextResponse } from "next/server";

import { settingService } from "@/features/core/setting/services/server/settingService";
import { canBypassMaintenance } from "@/features/core/setting/utils/maintenanceBypass";
import { createApiRoute } from "@/lib/routeFactory";

// ビルド時に確定するID（next.config.ts の env で注入）
const BUILD_ID = process.env.NEXT_BUILD_ID ?? "unknown";

/**
 * アプリステータスAPI（認証不要、セッションがあれば bypass 判定に利用）
 * - buildId: デプロイ検知用（ビルドごとに変わる）
 * - maintenance.active: メンテナンスモードが有効か（raw 状態）
 * - maintenance.bypassed: 当該リクエストの viewer がバイパス可能か
 *
 * クライアントは `active && !bypassed` のときに「ブロックされている」と解釈する。
 * バイパス判定は src/features/core/setting/utils/maintenanceBypass.ts に集約されており、
 * proxy（src/proxies/maintenance.ts）と完全に同じロジックで判定される。
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/health",
    operationType: "read",
  },
  async (_req, { session }) => {
    const active = await settingService.isMaintenanceActive();
    const bypassed = canBypassMaintenance(session);

    // デプロイ検知のためキャッシュを無効化
    return NextResponse.json(
      {
        buildId: BUILD_ID,
        maintenance: { active, bypassed },
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  },
);
