// src/app/api/admin/messaging/templates/[id]/versions/route.ts
//
// 管理者向け: テンプレートの公開した版の一覧(新しい順)。門 messagingTemplates が閉なら 404
//
// GET /api/admin/messaging/templates/[id]/versions → { items: AdminTemplateVersion[] }

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/templates/[id]/versions",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return { items: await messagingService.listMessageTemplateVersions(params.id) };
  },
);
