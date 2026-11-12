// src/app/api/admin/messaging/templates/[id]/versions/[version]/route.ts
//
// 管理者向け: テンプレートの版 1 つ(不変)。門 messagingTemplates が閉なら 404
//
// GET /api/admin/messaging/templates/[id]/versions/[version] → AdminTemplateVersion

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string; version: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/templates/[id]/versions/[version]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return messagingService.getMessageTemplateVersion(params.id, Number(params.version));
  },
);
