// src/app/api/admin/messaging/send/route.ts
//
// 管理者向け: 送る(テンプレートかその場で書く連絡、全員・ロール・audiences・選んだ利用者、今か予約。body は AdminSendInput)。門 messagingBroadcast が閉なら 404
//
// POST /api/admin/messaging/send

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { assertAdminSendKind } from "@/features/core/messaging/services/server/admin/send";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/send",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingBroadcast");
    const body = await req.json().catch(() => null);
    // 取引は選んだ利用者宛てだけ(service でも確かめる)
    assertAdminSendKind(body);
    return messagingService.adminSend(body);
  },
);
