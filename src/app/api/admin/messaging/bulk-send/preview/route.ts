// src/app/api/admin/messaging/bulk-send/preview/route.ts
//
// 管理者向け: 一括送信の描いたプレビュー(経路ごと、メールは描いた HTML。見本の受信者 = 操作した管理者)。
// body は送る画面のプレビューと同じ形({ message, category, channels? })、カテゴリーは一覧の一括(bulk)で送れる物。
// 門 messagingBroadcast には入れない(一括送信は管理一覧の一括操作が使うので、送る画面を閉じても使える)
//
// POST /api/admin/messaging/bulk-send/preview

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/bulk-send/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const body = await req.json().catch(() => null);
    return messagingService.adminBulkSendPreview(body);
  },
);
