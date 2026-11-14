// src/app/api/admin/messaging/dispatches/route.ts
//
// 管理者向け: 回の一覧(新しい順、keyset)。条件: from・to(作った時刻)・kind・category・channel・status・cursor・limit(既定 50、最大 100)。
// 定義の鍵(messageKey)では絞らない(D46: 画面は鍵を見せない。カテゴリーの選択肢は ./categories)
// 返す形: { items: AdminDispatchSummary[], nextCursor }(D37 の DTO)
//
// GET /api/admin/messaging/dispatches

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/dispatches",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => messagingService.listDispatches(Object.fromEntries(req.nextUrl.searchParams)),
);
