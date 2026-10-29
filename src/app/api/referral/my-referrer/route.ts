// src/app/api/referral/my-referrer/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { referralService } from "@/features/core/referral/services/server/referralService";

/**
 * GET /api/referral/my-referrer
 * ログインユーザーの紹介元（自分を招待した人）を取得
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/referral/my-referrer",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const referral = await referralService.getByInvitee(user.userId);

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
