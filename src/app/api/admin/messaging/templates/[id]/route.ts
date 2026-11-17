// src/app/api/admin/messaging/templates/[id]/route.ts
//
// 管理者向け: テンプレート 1 件(中身 = 最新の版と同じ)。門 messagingTemplates が閉なら 404
//
// GET   /api/admin/messaging/templates/[id]   AdminTemplateDetail
// PATCH /api/admin/messaging/templates/[id]   直して公開する { name?, description?, category?, layout?, values?, embedded? }(ひな形を替える時は values も)
//   → AdminTemplateSaveResult(中身が最新の版と違えば新しい版、同じなら unchanged: true。D134)
// DELETE /api/admin/messaging/templates/[id]  消す → { id, deleted: true }(版も消え、送った回は残る。システムテンプレートは 409、D137)

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

export const DELETE = createApiRoute<Params>(
  {
    operation: "DELETE /api/admin/messaging/templates/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingTemplates");
    return messagingService.deleteMessageTemplate(params.id);
  },
);
