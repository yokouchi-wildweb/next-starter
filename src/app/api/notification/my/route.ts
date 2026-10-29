// src/app/api/notification/my/route.ts
// 自分のお知らせ一覧（user）

import { createApiRoute } from "@/wiring/apiRoute";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my",
    operationType: "read",
    access: "authenticated",
  },
  async (req, { user }) => {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const viewer = notificationViewerFromSession(user);
    return notificationService.getMyNotifications(viewer, {
      limit,
      offset,
      unreadOnly,
    });
  }
);
