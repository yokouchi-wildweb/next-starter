// src/app/api/admin/messaging/definitions/preview/route.ts
//
// 管理者向け: 定義連絡の描いたプレビュー(送信チャンネルごと、メールは描いた HTML。見本の受信者 = 操作した管理者、記録の入口は選んだ最初の記録の値)。
// body = 送ると同じ { entry, edits?, channels?, vars? }。全員・ロール・グループの入口は門 messagingBroadcast が閉なら 404(service が見る)
//
// POST /api/admin/messaging/definitions/preview

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/definitions/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const body = await req.json().catch(() => null);
    return messagingService.adminDefinitionPreview(body);
  },
);
