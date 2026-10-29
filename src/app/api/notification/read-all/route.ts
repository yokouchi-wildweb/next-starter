// src/app/api/notification/read-all/route.ts
// 全既読マーク（user）

import { createApiRoute } from "@/wiring/apiRoute";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

export const POST = createApiRoute(
  {
    operation: "POST /api/notification/read-all",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const viewer = notificationViewerFromSession(user);
    await notificationService.markAllAsRead(viewer);
    return { success: true };
  }
);
