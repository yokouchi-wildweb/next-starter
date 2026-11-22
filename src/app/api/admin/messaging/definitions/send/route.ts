// src/app/api/admin/messaging/definitions/send/route.ts
//
// 管理者向け: 定義連絡を送る(D190)。body = { entry, edits?, channels?, vars?, idempotencyKey, scheduledAt?, reason? }、
// entry = 記録 { recordTarget, recordIds, message }(予約なし)か全員・ロール・グループ { message, target }。
// 記録の入口は門 messagingBroadcast の外(一覧の一括操作と同じ)。全員・ロール・グループの入口は service が門を見て、閉なら 404(同じ道なので道の印では分けない)。
// 管理者は access と service の両方で確かめる。入力の形・結果: src/features/core/messaging/services/server/admin/README.md「/api/admin/messaging/definitions」
//
// POST /api/admin/messaging/definitions/send

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/definitions/send",
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
    // 入力の検査は service(AdminDefinitionSendInputSchema)が行い、誤りは DomainError(400)
    return messagingService.adminDefinitionSend(body);
  },
);
