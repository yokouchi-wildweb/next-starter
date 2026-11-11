// src/app/api/admin/messaging/dispatches/[id]/deliveries/route.ts
//
// 管理者向け: 回の配達(古い順、keyset)。条件: status・channel・cursor・limit(既定 50、最大 100)
// 返す形: { items: AdminDeliveryRow[], nextCursor }(宛先あり、provider の生の値と誤りの文は無し)
//
// GET /api/admin/messaging/dispatches/[id]/deliveries

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/dispatches/[id]/deliveries",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => messagingService.listDeliveries(params.id, Object.fromEntries(req.nextUrl.searchParams)),
);
