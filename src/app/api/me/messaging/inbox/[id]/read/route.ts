// src/app/api/me/messaging/inbox/[id]/read/route.ts
//
// 本人に見える 1 件を既読にする(見えない行は 404)。門なし = 常に開(D57)
// POST → { ok: true }

import { NextResponse } from "next/server";

import { messagingService } from "@/features/core/messaging/services/server";
import { DomainError } from "@/lib/errors";
import { createMeRoute } from "@/wiring/apiRoute";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = createMeRoute<{ id: string }>(
  { operation: "POST /api/me/messaging/inbox/[id]/read", operationType: "write" },
  async (_req, { user, params }) => {
    if (!UUID_PATTERN.test(params.id)) throw new DomainError("お知らせが見つかりません", { status: 404 });
    await messagingService.markInboxRead({ userId: user.userId, role: user.role }, params.id);
    return NextResponse.json({ ok: true });
  },
);
