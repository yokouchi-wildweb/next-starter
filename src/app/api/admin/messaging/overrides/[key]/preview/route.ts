// src/app/api/admin/messaging/overrides/[key]/preview/route.ts
//
// 管理者向け: テキストの編集のプレビュー(D86)。門 messagingOverrides が閉なら 404
//
// POST /api/admin/messaging/overrides/[key]/preview   body { channel, values: { "<送信チャンネル.欄>": 値 } }
//   → { channel, html, text }: 送る時の値に未保存の値を重ね、連絡の描き方で描いた HTML(文字の欄に data-field="<送信チャンネル.欄>")。
//   送信チャンネルにプレビューが無ければ html は null。保存はしない

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { key: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/overrides/[key]/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("messagingOverrides");
    const body = await req.json().catch(() => null);
    return messagingService.previewMessageOverride(params.key, body);
  },
);
