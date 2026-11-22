// src/app/api/admin/messaging/dispatches/[id]/readers/route.ts
//
// 管理者向け: 送信の inApp を既読にした利用者(D210)。条件: cursor・limit(既定 50、最大 100)。既読の新しい順(keyset)
// 返す形: { items: [{ userId, name, readAt }], nextCursor }。時刻のある既読だけ(まとめて既読で読んだ人は並ばない。数は集計の API)。
// 削除した利用者は並べない。無い送信は 404。門は送信の画面と同じ messagingDispatches(住所 /api/admin/messaging/dispatches の下)
// 形: src/domains/core/messaging/services/server/admin/README.md「/dispatches/[id]/readers」
//
// GET /api/admin/messaging/dispatches/[id]/readers

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/dispatches/[id]/readers",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => messagingService.dispatchReaders(params.id, Object.fromEntries(req.nextUrl.searchParams)),
);
