// src/app/api/notification/my/unread-count/route.ts
// 未読数取得（user）

import { createApiRoute } from "@/wiring/apiRoute";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

export const GET = createApiRoute(
  {
    operation: "GET /api/notification/my/unread-count",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const viewer = notificationViewerFromSession(user);
    const count = await notificationService.getUnreadCount(viewer);
    return { count };
  }
);
