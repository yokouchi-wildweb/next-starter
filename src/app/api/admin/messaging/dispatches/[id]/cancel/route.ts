// src/app/api/admin/messaging/dispatches/[id]/cancel/route.ts
//
// 管理者向け: 予約の取り消し(予約でまだ展開していない回だけ cancelled、他は 409 + 理由の符号)。監査ログに 1 行
// 門: messagingDispatches の住所 /api/admin/messaging/dispatches の下(閉なら proxy が 404)
//
// POST /api/admin/messaging/dispatches/[id]/cancel

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/dispatches/[id]/cancel",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminCancelScheduled(params.id),
);
