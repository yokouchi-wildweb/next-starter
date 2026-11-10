// src/app/api/me/messaging/inbox/route.ts
//
// 本人の受け取り箱の一覧(見える行だけ、公開の時刻・id の降順の keyset)。門なし = 常に開(D57)
// GET ?cursor=<前のページの nextCursor>&limit=<1〜50、既定 20>&unreadOnly=true|1 → { items: InboxItemDto[], nextCursor }

import { NextResponse } from "next/server";

import { messagingService } from "@/features/core/messaging/services/server";
import { createMeRoute } from "@/wiring/apiRoute";

export const GET = createMeRoute(
  { operation: "GET /api/me/messaging/inbox", operationType: "read" },
  async (req, { user }) => {
    const params = new URL(req.url).searchParams;
    const limit = params.get("limit");
    const unreadOnly = params.get("unreadOnly");
    const page = await messagingService.listInbox(
      { userId: user.userId, role: user.role },
      {
        cursor: params.get("cursor"),
        limit: limit ? Number(limit) || undefined : undefined,
        unreadOnly: unreadOnly === "true" || unreadOnly === "1",
      },
    );
    return NextResponse.json(page);
  },
);
