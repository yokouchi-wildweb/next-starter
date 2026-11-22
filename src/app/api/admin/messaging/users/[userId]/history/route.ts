// src/app/api/admin/messaging/users/[userId]/history/route.ts
//
// 管理者向け: 利用者ごとの連絡の履歴(D37・D215)。条件: cursor・limit(既定 50、最大 100)
// 返す形: { items: UserMessageHistoryItem[], nextCursor }。配達(type "delivery")と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせ
// (type "sharedInApp"、配達の状態なし)を時刻の新しい順に 1 本で。居ない利用者は 404
// 門の外(利用者の管理画面が使う。送信の管理画面を閉じても読める、send-results と同じ)。形: src/domains/core/messaging/services/server/history/README.md
//
// GET /api/admin/messaging/users/[userId]/history

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

type Params = { userId: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/users/[userId]/history",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) =>
    messagingService.listUserMessageHistory(params.userId, Object.fromEntries(req.nextUrl.searchParams)),
);
