// src/app/api/admin/messaging/recipients/[userId]/channels/route.ts
//
// 管理者向け: 1 人の利用者の受け取れる送信チャンネル(D214 (2))。条件: message(連絡定義の鍵)か category(自由連絡のカテゴリー)、どちらか 1 つか無し
// 返す形: { <channel>: { available: true } | { available: false, reason: channel_off | no_address | preference | suppression } }
// 門の外(1 人宛ての送る画面は一覧の操作からも開く)。無い・削除した利用者と読めない連絡定義は 404、知らないカテゴリー・両方の指定は 400。
// 形: src/features/core/messaging/services/server/admin/README.md「/api/admin/messaging/recipients」
//
// GET /api/admin/messaging/recipients/[userId]/channels

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { userId: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/recipients/[userId]/channels",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => messagingService.recipientChannels(params.userId, Object.fromEntries(req.nextUrl.searchParams)),
);
