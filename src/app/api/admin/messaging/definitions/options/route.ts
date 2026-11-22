// src/app/api/admin/messaging/definitions/options/route.ts
//
// 管理者向け: 定義連絡の選択肢(D214 (3)、汎用の送るモーダルが組む材料)。条件はどちらか 1 つ:
// - ?recordTarget=<項目の鍵> → { recordTarget: { key, label }, definitions }(項目の messages のうち読める・止められていない・records を許す定義。門の外)
// - ?entry=broadcast → { recordTarget: null, definitions }(全員・ロール・グループのどれかを許す定義。門 messagingBroadcast は service が見て閉なら 404)
// 定義ごとの形: src/domains/core/messaging/services/server/admin/README.md「/api/admin/messaging/definitions」
//
// GET /api/admin/messaging/definitions/options

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/definitions/options",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => messagingService.adminDefinitionOptions(Object.fromEntries(req.nextUrl.searchParams)),
);
