// src/app/api/me/messaging/inbox/read-all/route.ts
//
// 本人の受け取り箱を全部既読にする(watermark を今に進め、個別の既読の行を掃く)。門なし = 常に開(D57)
// POST → { ok: true }

import { NextResponse } from "next/server";

import { messagingService } from "@/features/core/messaging/services/server";
import { createMeRoute } from "@/wiring/apiRoute";

export const POST = createMeRoute(
  { operation: "POST /api/me/messaging/inbox/read-all", operationType: "write" },
  async (_req, { user }) => {
    await messagingService.markAllInboxRead({ userId: user.userId, role: user.role });
    return NextResponse.json({ ok: true });
  },
);
