// src/app/api/admin/messaging/dispatches/[id]/retract/route.ts
//
// 管理者向け: 取り下げ(回のお知らせの行を消し、未送信の配達を止め、retracted_at。送ったメールは取り戻せない)。
// 2 回目・予約のままの回は 409 + 理由の符号。監査ログに 1 行
// 門: messagingDispatches の住所 /api/admin/messaging/dispatches の下(閉なら proxy が 404)
//
// POST /api/admin/messaging/dispatches/[id]/retract

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/dispatches/[id]/retract",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminRetract(params.id),
);
