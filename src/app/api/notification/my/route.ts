// src/app/api/notification/my/route.ts
// 自分のお知らせ一覧（user）

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my",
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

    return notificationService.getMyNotifications(session.userId, session.role, {
      limit,
      offset,
      unreadOnly,
    });
  }
);
