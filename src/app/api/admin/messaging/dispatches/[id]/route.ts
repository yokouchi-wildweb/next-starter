// src/app/api/admin/messaging/dispatches/[id]/route.ts
//
// 管理者向け: 回 1 件(AdminDispatchDetail。本文は記録の段が vars / full のときだけ)
//
// GET /api/admin/messaging/dispatches/[id]

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/dispatches/[id]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.findDispatch(params.id),
);
