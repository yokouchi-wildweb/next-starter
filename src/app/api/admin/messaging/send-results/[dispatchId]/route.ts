// src/app/api/admin/messaging/send-results/[dispatchId]/route.ts
//
// 管理者向け: 送信の結果(D214 (1))。条件: cursor・limit(既定 50、最大 100)
// 返す形: { channels: { <channel>: 数 }, failed: { items: [{ userId, name, channel, status, reason }], nextCursor } }
// 門の外(一覧の一括送信と同じく、送信の管理画面を閉じても送れる所で結果が見られる)。結果の材料だけで、送信の詳細の代わりにはしない。
// 無い・削除した送信は 404。形: src/domains/core/messaging/services/server/admin/README.md「/api/admin/messaging/send-results」
//
// GET /api/admin/messaging/send-results/[dispatchId]

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

type Params = { dispatchId: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/send-results/[dispatchId]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => messagingService.sendResults(params.dispatchId, Object.fromEntries(req.nextUrl.searchParams)),
);
