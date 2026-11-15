// src/app/api/admin/messaging/send/options/route.ts
//
// 管理者向け: 送る画面の選択肢(経路・ロール・使用中のグループ・公開したテンプレート・カテゴリー・予約できる日数)。門 messagingBroadcast が閉なら 404
//
// GET /api/admin/messaging/send/options

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/send/options",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => {
    gate.assert("messagingBroadcast");
    return messagingService.adminSendOptions();
  },
);
