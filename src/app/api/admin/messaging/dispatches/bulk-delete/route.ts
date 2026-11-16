// src/app/api/admin/messaging/dispatches/bulk-delete/route.ts
//
// 管理者向け: 回をまとめて削除する(D88)。body { ids }(1〜100 件)→ { results: [{ dispatchId, ok, result | reason・message }] }。回ごとに 1 件の削除と同じ(監査も回ごと)
// 門: messagingDispatches の住所 /api/admin/messaging/dispatches の下(閉なら proxy が 404)
//
// POST /api/admin/messaging/dispatches/bulk-delete

import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/messaging/dispatches/bulk-delete",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new DomainError("送信の id の指定が正しくありません", { status: 400 });
    }
    return messagingService.adminBulkDeleteDispatches(body);
  },
);
