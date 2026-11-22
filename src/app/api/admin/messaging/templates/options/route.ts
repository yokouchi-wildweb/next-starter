// src/app/api/admin/messaging/templates/options/route.ts
//
// 管理者向け: テンプレートの画面の選択肢。門 messagingTemplates が閉なら 404
// 返す形: { channels(有効な送信チャンネルだけ), categories, layouts(管理者が選べるレイアウト), baseCatalog(専用の宣言の前から書ける埋め込み情報: 鍵・別名・出どころ・説明) }
// (送信チャンネル・カテゴリーは受け口なので fork の物も入る。画面は決め打ちの一覧を持たない)
//
// GET /api/admin/messaging/templates/options

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { getMessageTemplateOptions } from "@/domains/core/messaging/services/server/templates";

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
