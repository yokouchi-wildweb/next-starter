// src/app/api/notification/my/page/route.ts
// 自分宛通知のページ取得（user）: items + total + hasMore を 1 リクエストで返す
// 無限スクロール / ページネーション UI 推奨パス
// クエリ: limit, offset, unreadOnly

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my/page",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    return notificationService.getMyNotificationsPage(session.userId, session.role, {
      limit,
      offset,
      unreadOnly,
    });
  }
);
