// src/app/api/admin/messaging/bulk-send/route.ts
//
// 管理者向け: 管理者がその場で書く連絡の一括送信。宛先は { userIds } か { target, recordIds }(受け口 bulkSendTargets)、カテゴリー category は必須。
// 管理者は access と service の両方で確かめる。入力の形・結果: src/features/core/messaging/README.md「管理の送信と回の読む口」
//
// GET  /api/admin/messaging/bulk-send   選択肢(一覧の一括で送れるカテゴリー)
// POST /api/admin/messaging/bulk-send

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/bulk-send",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => messagingService.adminBulkSendOptions(),
);

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/bulk-send",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }
    // 入力の検査は service(AdminBulkSendInputSchema)が行い、誤りは DomainError(400)
    return messagingService.adminBulkSend(body as Parameters<typeof messagingService.adminBulkSend>[0]);
  },
);
