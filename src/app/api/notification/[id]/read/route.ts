// src/app/api/notification/[id]/read/route.ts
// 既読マーク（user）

import { createApiRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { notificationViewerFromSession } from "@/features/core/notification/services/server/notification/viewer";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/notification/[id]/read",
    operationType: "write",
    access: "custom",
  },
  async (_req, { session, params }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    const { id } = await params;
    await notificationService.markAsRead(id, notificationViewerFromSession(session));
    return { success: true };
  }
);
