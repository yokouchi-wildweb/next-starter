// src/app/api/activity/dau/route.ts
// DAU記録エンドポイント — 認証済みユーザーの日次アクティビティを記録

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { recordDailyActivity } from "@/features/core/analytics/services/server/dauService";

export const POST = createApiRoute(
  {
    operation: "POST /api/activity/dau",
    operationType: "write",
  },
  async (_req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "認証が必要です。" }, { status: 401 });
    }

    await recordDailyActivity(session.userId);

    return { recorded: true };
  },
);
