// src/app/api/admin/messaging/overrides/route.ts
//
// 管理者向け: 管理画面で文言を直せる連絡の一覧(AdminOverrideMessageSummary[])。門 messagingOverrides が閉なら 404
//
// GET /api/admin/messaging/overrides

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/overrides",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => {
    gate.assert("messagingOverrides");
    return { items: await messagingService.listMessageOverrides() };
  },
);
