// src/app/api/admin/messaging/dispatches/[id]/continue/route.ts
//
// 管理者向け: 回を 1 束だけ進める(続きを送る。processing の回だけ、他は 409)。監査ログに 1 行
// 返す形: { expanded, claimed, sent, failed, completed }
//
// POST /api/admin/messaging/dispatches/[id]/continue

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/dispatches/[id]/continue",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminContinueSending(params.id),
);
