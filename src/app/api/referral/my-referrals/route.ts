// src/app/api/referral/my-referrals/route.ts

import { NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { referralService } from "@/features/core/referral/services/server/referralService";

/**
 * GET /api/referral/my-referrals
 * ログインユーザーが招待した人の一覧を取得
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/referral/my-referrals",
    operationType: "read",
  },
  async (_req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const referrals = await referralService.getByInviter(session.userId);

    return {
      referrals: referrals.map((r) => ({
        id: r.id,
        inviteeUserId: r.invitee_user_id,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }
);
