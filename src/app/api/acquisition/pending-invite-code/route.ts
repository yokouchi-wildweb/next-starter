// src/app/api/acquisition/pending-invite-code/route.ts
//
// 招待リンク（?invite=CODE）経由で cookie に保持されている招待コードを返す。
// サインアップフォームが招待コード欄のプリフィルに使う。
//
// acq_touches cookie は httpOnly のためクライアント JS から直接読めず、
// この公開エンドポイントがサーバーサイドで復元して返す。
// リクエスト元自身の cookie の中身を返すだけなので認可は不要（access: "public"）。

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { createApiRoute } from "@/lib/routeFactory";
import { ACQUISITION_COOKIE_NAME } from "@/features/core/userAcquisition/constants";
import {
  findLatestInviteCode,
  parseAttributionCookie,
  toAcquisitionTouch,
} from "@/features/core/userAcquisition/lib/attributionCookie";

export const GET = createApiRoute(
  {
    operation: "GET /api/acquisition/pending-invite-code",
    operationType: "read",
    access: "public",
  },
  async (req) => {
    if (!ACQUISITION_CONFIG.enabled || !APP_FEATURES.marketing.referral.enabled) {
      return { inviteCode: null };
    }

    const touches = parseAttributionCookie(
      req.cookies.get(ACQUISITION_COOKIE_NAME)?.value,
    );
    const inviteCode = findLatestInviteCode(touches.map(toAcquisitionTouch));

    return { inviteCode };
  },
);
