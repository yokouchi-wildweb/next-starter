// src/app/api/admin/messaging/send/test/route.ts
//
// 管理者向け: 自分へのテスト送信(宛先 = 操作した管理者だけ、is_test)。門 messagingBroadcast が閉なら 404
//
// POST /api/admin/messaging/send/test

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/send/test",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingBroadcast");
    const body = await req.json().catch(() => null);
    return messagingService.adminSendTest(body);
  },
);
