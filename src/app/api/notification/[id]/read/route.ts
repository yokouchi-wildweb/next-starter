// src/app/api/notification/[id]/read/route.ts
// 既読マーク（user）

import { createApiRoute } from "@/wiring/apiRoute";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

type Params = { id: string };

export const POST = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "POST /api/notification/[id]/read",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { user, params }) => {
    const { id } = await params;
    await notificationService.markAsRead(id, notificationViewerFromSession(user));
    return { success: true };
  }
);
