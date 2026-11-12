// src/app/api/admin/messaging/templates/[id]/publish/route.ts
//
// 管理者向け: 今の中身を版として公開する(版は不変、前の版から変更が無ければ 409)。門 messagingTemplates が閉なら 404
//
// POST /api/admin/messaging/templates/[id]/publish

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/templates/[id]/publish",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return messagingService.publishMessageTemplate(params.id);
  },
);
