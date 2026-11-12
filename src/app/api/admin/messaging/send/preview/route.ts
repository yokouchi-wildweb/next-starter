// src/app/api/admin/messaging/send/preview/route.ts
//
// 管理者向け: 描いたプレビュー(経路ごと、メールは描いた HTML。見本の受信者 = 操作した管理者)。門 messagingBroadcast が閉なら 404
//
// POST /api/admin/messaging/send/preview

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/send/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingBroadcast");
    const body = await req.json().catch(() => null);
    return messagingService.adminSendPreview(body);
  },
);
