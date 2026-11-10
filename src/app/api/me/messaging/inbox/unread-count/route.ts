// src/app/api/me/messaging/inbox/unread-count/route.ts
//
// 本人の受け取り箱の未読の数。門なし = 常に開(D57)
// GET → { count }

import { NextResponse } from "next/server";

import { messagingService } from "@/features/core/messaging/services/server";
import { createMeRoute } from "@/wiring/apiRoute";

export const GET = createMeRoute(
  { operation: "GET /api/me/messaging/inbox/unread-count", operationType: "read" },
  async (_req, { user }) => {
    const count = await messagingService.inboxUnreadCount({ userId: user.userId, role: user.role });
    return NextResponse.json({ count });
  },
);
