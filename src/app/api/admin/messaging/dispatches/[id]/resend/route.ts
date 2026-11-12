// src/app/api/admin/messaging/dispatches/[id]/resend/route.ts
//
// 管理者向け: 失敗の再送 body { includeUnknown? }(unknown は明示の時だけ。送り直せない回は 409 + 理由の符号)。監査ログに 1 行
// 返す形: { dispatchId, mode: requeue | new_dispatch, failed, unknown, newDispatchId }
// 門: messagingDispatches の住所 /api/admin/messaging/dispatches の下(閉なら proxy が 404)
//
// POST /api/admin/messaging/dispatches/[id]/resend

import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/messaging/dispatches/[id]/resend",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    // 空の body = {}(unknown を含めない)
    const text = await req.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new DomainError("再送の入力が正しくありません", { status: 400 });
      }
    }
    return messagingService.adminResendFailed(params.id, body);
  },
);
