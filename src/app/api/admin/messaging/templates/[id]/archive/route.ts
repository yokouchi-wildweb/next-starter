// src/app/api/admin/messaging/templates/[id]/archive/route.ts
//
// 管理者向け: テンプレートを取り下げる(archived。版は残る)。門 messagingTemplates が閉なら 404
//
// POST /api/admin/messaging/templates/[id]/archive

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/templates/[id]/archive",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return messagingService.archiveMessageTemplate(params.id);
  },
);
