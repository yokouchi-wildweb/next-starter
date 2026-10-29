// src/app/api/activity/dau/route.ts
// DAU記録エンドポイント — 認証済みユーザーの日次アクティビティを記録

import { createApiRoute } from "@/wiring/apiRoute";
import { recordDailyActivity } from "@/features/core/analytics/services/server/dauService";

export const POST = createApiRoute(
  {
    operation: "POST /api/activity/dau",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { user }) => {
    await recordDailyActivity(user.userId);

    return { recorded: true };
  },
);
