// src/app/api/admin/messaging/definitions/estimate/route.ts
//
// 管理者向け: 定義連絡の全員・ロール・グループの人数の見込み(D217)。body = { message, target: { type: "all" } | { type: "role", roles } | { type: "group", groupId } }
// → { count, fixedAtSend, memberLimit?, overLimit? }(自由連絡の POST send/estimate と同じ形、送る時に数え直す)。
// 定義の adminTargets の外は 400。門 messagingBroadcast は service が見て、閉なら 404(definitions/ の道は記録の入口と同じなので道の印では分けない)
//
// POST /api/admin/messaging/definitions/estimate

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/definitions/estimate",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const body = await req.json().catch(() => null);
    return messagingService.adminDefinitionEstimate(body);
  },
);
