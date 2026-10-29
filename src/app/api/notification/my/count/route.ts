// src/app/api/notification/my/count/route.ts
// 自分宛通知の総件数取得（user）
// クエリ: unreadOnly=true|false（省略時は false）

import { createApiRoute } from "@/wiring/apiRoute";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my/count",
    operationType: "read",
    access: "authenticated",
  },
  async (req, { user }) => {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const viewer = notificationViewerFromSession(user);
    const count = await notificationService.getMyNotificationsCount(viewer, {
      unreadOnly,
    });
    return { count };
  }
);
