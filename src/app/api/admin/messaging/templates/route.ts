// src/app/api/admin/messaging/templates/route.ts
//
// 管理者向け: 保存されたテンプレート。門 messagingTemplates が閉なら 404
//
// GET  /api/admin/messaging/templates   一覧(kind・cursor・limit、新しい順。kind = その種別のカテゴリーとシステムテンプレート D135)→ { items, nextCursor }
// POST /api/admin/messaging/templates   作って公開する(版 1、D134){ name, description?, category, layout, values, vars? }(鍵はサーバーが作る)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/templates",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingTemplates");
    return messagingService.listMessageTemplates(Object.fromEntries(req.nextUrl.searchParams));
  },
);

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/templates",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("messagingTemplates");
    const body = await req.json().catch(() => null);
    return messagingService.createMessageTemplate(body);
  },
);
