// src/app/api/notification/read-all/route.ts
// 全既読マーク（user）

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

export const POST = createApiRoute(
  {
    operation: "POST /api/notification/read-all",
    operationType: "write",
  },
  async (_req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    await notificationService.markAllAsRead(session.userId, session.role);
    return { success: true };
  }
);
