// src/app/api/referral/my-referrer/route.ts

import { NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { referralService } from "@/features/core/referral/services/server/referralService";

/**
 * GET /api/referral/my-referrer
 * ログインユーザーの紹介元（自分を招待した人）を取得
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/referral/my-referrer",
    operationType: "read",
  },
  async (_req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const referral = await referralService.getByInvitee(session.userId);

    if (!referral) {
      return { referral: null };
    }

    return {
      referral: {
        id: referral.id,
        inviterUserId: referral.inviter_user_id,
        status: referral.status,
        createdAt: referral.createdAt,
      },
    };
  }
);
