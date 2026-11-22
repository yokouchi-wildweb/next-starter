// src/app/api/health/route.ts

import { NextResponse } from "next/server";

import type { AppStatusResponse } from "@/lib/appStatus";
import { settingService } from "@/domains/core/setting/services/server/settingService";
import { canBypassMaintenance } from "@/domains/core/setting/utils/maintenanceBypass";
import { createApiRoute } from "@/wiring/apiRoute";

// ビルド時に確定するID（next.config.ts の env で注入）
const BUILD_ID = process.env.NEXT_BUILD_ID ?? "unknown";

/**
 * アプリステータスAPI（認証不要、セッションがあれば bypass 判定に利用）
 * - buildId: デプロイ検知用（ビルドごとに変わる）
 * - maintenance.active: メンテナンスモードが有効か（raw 状態）
 * - maintenance.bypassed: 当該リクエストの viewer がバイパス可能か
 *
 * クライアントは `active && !bypassed` のときに「ブロックされている」と解釈する。
 * バイパス判定は src/domains/core/setting/utils/maintenanceBypass.ts に集約されており、
 * proxy（src/proxies/maintenance.ts）と完全に同じロジックで判定される。
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/health",
    operationType: "read",
    access: "public",
  },
  async (_req, { user }) => {
    const active = await settingService.isMaintenanceActive();
    const bypassed = canBypassMaintenance(user);

    // デプロイ検知のためキャッシュを無効化
    return NextResponse.json(
      {
        buildId: BUILD_ID,
        maintenance: { active, bypassed },
      } satisfies AppStatusResponse,
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  },
);
