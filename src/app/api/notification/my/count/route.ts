// src/app/api/notification/my/count/route.ts
// 自分宛通知の総件数取得（user）
// クエリ: unreadOnly=true|false（省略時は false）

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my/count",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const viewer = notificationViewerFromSession(session);
    const count = await notificationService.getMyNotificationsCount(viewer, {
      unreadOnly,
    });
    return { count };
  }
);
