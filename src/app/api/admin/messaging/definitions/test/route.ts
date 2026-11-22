// src/app/api/admin/messaging/definitions/test/route.ts
//
// 管理者向け: 定義連絡の自分へのテスト送信(宛先 = 操作した管理者だけ、is_test。記録の入口は選んだ最初の記録の値、afterSend は呼ばない)。
// body = { entry, edits?, channels?, vars?, idempotencyKey? }。全員・ロール・グループの入口は門 messagingBroadcast が閉なら 404(service が見る)
//
// POST /api/admin/messaging/definitions/test

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/definitions/test",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const body = await req.json().catch(() => null);
    return messagingService.adminDefinitionTest(body);
  },
);
