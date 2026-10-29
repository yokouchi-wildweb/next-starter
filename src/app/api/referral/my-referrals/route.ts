// src/app/api/referral/my-referrals/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { referralService } from "@/features/core/referral/services/server/referralService";

/**
 * GET /api/referral/my-referrals
 * ログインユーザーが招待した人の一覧を取得
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/referral/my-referrals",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const referrals = await referralService.getByInviter(user.userId);

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
