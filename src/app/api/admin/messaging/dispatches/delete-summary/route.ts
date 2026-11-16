// src/app/api/admin/messaging/dispatches/delete-summary/route.ts
//
// 管理者向け: 削除の見込み(確認の画面、D88)。body { ids }(1〜100 件)→ { found, deleted, scheduled, unsent, channels: [{ key, label, removable, sent }], sharedInbox }。書かない
// 門: messagingDispatches の住所 /api/admin/messaging/dispatches の下(閉なら proxy が 404)
//
// POST /api/admin/messaging/dispatches/delete-summary

import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/dispatches/delete-summary",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new DomainError("送信の id の指定が正しくありません", { status: 400 });
    }
    return messagingService.adminDispatchDeleteSummary(body);
  },
);
