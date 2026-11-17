// src/app/api/admin/messaging/dispatches/[id]/preview/route.ts
//
// 管理者向け: 送った回のプレビュー(AdminDispatchPreview)。回のひな形と欄の中身を回の vars・埋め込み情報の値で差し込み、
// 経路ごとに メールの HTML / お知らせの描き方の材料を返す。中身を残していない回は cannotRender に理由
//
// GET /api/admin/messaging/dispatches/[id]/preview

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/dispatches/[id]/preview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminDispatchPreview(params.id),
);
