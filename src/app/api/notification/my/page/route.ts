// src/app/api/notification/my/page/route.ts
// 自分宛通知のページ取得（user）: keyset ページネーションで items + hasMore + nextCursor を返す
// 無限スクロール推奨パス
// クエリ: limit, cursor, unreadOnly

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

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
    const cursor = searchParams.get("cursor") ?? undefined;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const viewer = notificationViewerFromSession(session);
    return notificationService.getMyNotificationsPage(viewer, {
      limit,
      cursor,
      unreadOnly,
    });
  }
);
