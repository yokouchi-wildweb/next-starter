// src/app/api/notification/my/unread-count/route.ts
// 未読数取得（user）

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my/unread-count",
    operationType: "read",
  },
  async (_req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    const count = await notificationService.getUnreadCount(session.userId, session.role);
    return { count };
  }
);
