// src/app/api/admin/messaging/send/estimate/route.ts
//
// 管理者向け: 宛先数の見込み { audience } → { count, capped, fixedAtSend }(送る時に数え直す)。門 messagingBroadcast が閉なら 404
//
// POST /api/admin/messaging/send/estimate

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/send/estimate",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingBroadcast");
    const body = await req.json().catch(() => null);
    return messagingService.adminSendEstimate(body);
  },
);
