// src/app/api/admin/messaging/templates/[id]/route.ts
//
// 管理者向け: テンプレート 1 件(今の中身 = 下書き)。門 messagingTemplates が閉なら 404
//
// GET   /api/admin/messaging/templates/[id]   AdminTemplateDetail
// PATCH /api/admin/messaging/templates/[id]   下書きを直す { name?, description?, category?, channels?, content?, variables? }(公開した版は変わらない)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/templates/[id]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return messagingService.getMessageTemplate(params.id);
  },
);

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/messaging/templates/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("messagingTemplates");
    const body = await req.json().catch(() => null);
    return messagingService.updateMessageTemplate(params.id, body);
  },
);
