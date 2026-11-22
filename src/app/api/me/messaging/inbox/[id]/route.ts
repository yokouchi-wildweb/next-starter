// src/app/api/me/messaging/inbox/[id]/route.ts
//
// 本人に見える 1 件の詳細(自分の行か、見える共有の行だけ。見えない行は 404)。門なし = 常に開(D57)
// GET → InboxItemDetailDto(一覧の形 + レイアウトの鍵・版・欄の中身・inApp の欄の宣言。描けない行は要約だけ、指令 60)

import { NextResponse } from "next/server";

import { messagingService } from "@/domains/core/messaging/services/server";
import { DomainError } from "@/lib/errors";
import { createMeRoute } from "@/wiring/apiRoute";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = createMeRoute<{ id: string }>(
  { operation: "GET /api/me/messaging/inbox/[id]", operationType: "read" },
  async (_req, { user, params }) => {
    if (!UUID_PATTERN.test(params.id)) throw new DomainError("お知らせが見つかりません", { status: 404 });
    return NextResponse.json(await messagingService.getInboxItem({ userId: user.userId, role: user.role }, params.id));
  },
);
