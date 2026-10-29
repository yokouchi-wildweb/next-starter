// src/app/api/notification/[id]/readers/route.ts
// 通知ごとの既読ユーザー一覧（管理者のみ、ページング対応）

import { createApiRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/notification/[id]/readers",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    const { id } = params;
    if (!id) {
      throw new DomainError("通知IDが指定されていません。", { status: 400 });
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");

    return await notificationService.getReadersWithUsers(id, { page, limit });
  },
);
