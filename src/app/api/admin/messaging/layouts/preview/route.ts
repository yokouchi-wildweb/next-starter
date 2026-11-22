// src/app/api/admin/messaging/layouts/preview/route.ts
//
// 管理者向け: レイアウトのプレビュー(テンプレートの作る・直す画面と送る画面、D114)。
// テンプレート(messagingTemplates)と送る画面(messagingBroadcast)のどちらも閉なら 404
//
// POST /api/admin/messaging/layouts/preview   body { layout, channel, category?, values }
//   → { channel, html, text, title, summary, cannotRender }: 保存しない中身を送る口と同じ 3 段で描く(メールは送る HTML)。保存しない

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { previewMessageLayout } from "@/features/core/messaging/services/server/templates";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/layouts/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    if (!gate.enabled("messagingBroadcast")) gate.assert("messagingTemplates");
    const body = await req.json().catch(() => null);
    return previewMessageLayout(body);
  },
);
