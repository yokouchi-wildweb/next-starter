// src/app/api/referral/pending-invite-code/route.ts
//
// 招待リンク（?invite=CODE）経由で cookie に保持されている招待コードを返す。
// サインアップフォームが招待コード欄のプリフィルに使う。
//
// 招待コードは referral 専用 cookie（pending_invite, httpOnly）に保持されており、
// クライアント JS から直接読めないため、この公開エンドポイントがサーバーサイドで返す。
// リクエスト元自身の cookie の中身を返すだけなので認可は不要（access: "public"）。
//
// ゲートは referral 機能フラグのみ。流入経路解析（記録の opt-in）とは独立。

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { INVITE_LINK_COOKIE_NAME } from "@/features/core/referral/lib/inviteLinkCookie";

export const GET = createApiRoute(
  {
    operation: "GET /api/referral/pending-invite-code",
    operationType: "read",
    access: "public",
  },
  async (req) => {
    if (!gate.enabled("referral")) {
      return { inviteCode: null };
    }

    const inviteCode = req.cookies.get(INVITE_LINK_COOKIE_NAME)?.value?.trim() || null;

    return { inviteCode };
  },
);
