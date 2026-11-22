// src/app/api/admin/messaging/dispatches/[id]/route.ts
//
// 管理者向け: 送信 1 件(AdminDispatchDetail。本文は記録の段が vars / full のときだけ)と送信の削除(D88)
// - DELETE: どの状態の送信も消す(論理削除。未送信を止め、予約は送られず、消せる送信チャンネルの届けた物を消す。送ったメール・LINE は残る)。
//   削除済みは同じ結果(消せる送信チャンネルを呼び直す)。返す形 AdminDeleteResult。監査ログに 1 行
//
// GET /api/admin/messaging/dispatches/[id]
// DELETE /api/admin/messaging/dispatches/[id]

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

export const DELETE = createApiRoute<Params>(
  {
    operation: "DELETE /api/admin/messaging/dispatches/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminDeleteDispatch(params.id),
);
