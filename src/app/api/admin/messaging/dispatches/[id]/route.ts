// src/app/api/admin/messaging/dispatches/[id]/route.ts
//
// 管理者向け: 送信 1 件(AdminDispatchDetail。本文は記録の段が vars / full のときだけ)と送信の削除(D88)
// - DELETE: どの状態の送信も消す(論理削除。未送信を止め、予約は送られず、消せる送信チャンネルの届けた物を消す。送ったメール・LINE は残る)。
//   削除済みは同じ結果(消せる送信チャンネルを呼び直す)。返す形 AdminDeleteResult。監査ログに 1 行
// - PATCH: 予約した送信を送る前に直す(D210)。本文 { edits?, channels?, scheduledAt? }(文面の欄・送信チャンネル・時刻だけ、宛先は変えない)。
//   予約のままで削除していない送信だけ(ほかと cron が先に拾った送信は 409)、送る時と同じ検査(400)。返す形 AdminDispatchDetail。監査ログに 1 行
//
// GET /api/admin/messaging/dispatches/[id]
// PATCH /api/admin/messaging/dispatches/[id]
// DELETE /api/admin/messaging/dispatches/[id]

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

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

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/messaging/dispatches/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => messagingService.adminEditScheduledDispatch(params.id, await req.json().catch(() => null)),
);
