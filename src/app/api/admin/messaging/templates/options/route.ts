// src/app/api/admin/messaging/templates/options/route.ts
//
// 管理者向け: テンプレートの画面の選択肢。門 messagingTemplates が閉なら 404
// 返す形: { channels: {key, label}[](有効な経路だけ), categories: {key, label, description}[], baseAllowedKeys: string[] }
// (経路・種類は受け口なので fork の物も入る。画面は決め打ちの一覧を持たない)
//
// GET /api/admin/messaging/templates/options

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { getMessageTemplateOptions } from "@/features/core/messaging/services/server/templates";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/templates/options",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => {
    gate.assert("messagingTemplates");
    return getMessageTemplateOptions();
  },
);
