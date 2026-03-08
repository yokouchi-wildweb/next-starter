// src/app/api/notification/[id]/read/route.ts
// 既読マーク（user）

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/notification/[id]/read",
    operationType: "write",
  },
  async (_req, { session, params }) => {
    if (!session) {
      throw new DomainError("認証が必要です。", { status: 401 });
    }

    const { id } = await params;
    await notificationService.markAsRead(id, session.userId);
    return { success: true };
  }
);
