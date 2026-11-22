// src/app/api/admin/messaging/definitions/record-targets/route.ts
//
// 管理者向け: 記録の宛先の選択肢(門番を通った項目 { key, label, messages: { key, label }[] }。送れる連絡定義は項目の messages のうち読める物)。
// 門 messagingBroadcast の外(記録の入口と同じ)
//
// GET /api/admin/messaging/definitions/record-targets

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/definitions/record-targets",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => messagingService.adminRecordTargetOptions(),
);
