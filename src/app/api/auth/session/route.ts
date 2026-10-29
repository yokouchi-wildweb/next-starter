// src/app/api/auth/session/route.ts

import { USER_STATUSES } from "@/features/core/user/constants";
import { refreshSessionResponse } from "@/features/core/auth/services/server/session/refreshSessionResponse";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  {
    operation: "GET /api/auth/session",
    operationType: "read",
    access: "public",
    // status を問わず利用者を返す（休会中の人の再有効化の画面などが、今の status を知る必要があるため）
    allowStatuses: USER_STATUSES,
  },
  // 利用者は Factory が解いた ctx.user（JWT 検証 + DB 照合済み）。確認・再発行・Cookie の消去はサービスが行う
  async (_req, { user }) => refreshSessionResponse(user),
);
