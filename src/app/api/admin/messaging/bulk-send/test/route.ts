// src/app/api/admin/messaging/bulk-send/test/route.ts
//
// 管理者向け: 一括送信の自分へのテスト送信(宛先 = 操作した管理者だけ、is_test)。
// body は送る画面のテスト送信と同じ形({ message, category, channels?, idempotencyKey? })、カテゴリーは一覧の一括(bulk)で送れる物。
// 門 messagingBroadcast には入れない
//
// POST /api/admin/messaging/bulk-send/test

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/bulk-send/test",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const body = await req.json().catch(() => null);
    return messagingService.adminBulkSendTest(body);
  },
);
