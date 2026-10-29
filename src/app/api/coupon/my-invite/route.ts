// src/app/api/coupon/my-invite/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { couponService } from "@/features/core/coupon/services/server/couponService";

/**
 * GET /api/coupon/my-invite
 * ログインユーザーの招待コードを取得（発行しない）
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/coupon/my-invite",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const userId = user.userId;

    const inviteCode = await couponService.getInviteCode(userId);

    if (!inviteCode) {
      return { inviteCode: null };
    }

    return {
      inviteCode: {
        id: inviteCode.id,
        code: inviteCode.code,
        name: inviteCode.name,
        description: inviteCode.description,
        currentTotalUses: inviteCode.current_total_uses,
        maxTotalUses: inviteCode.max_total_uses,
        createdAt: inviteCode.createdAt,
      },
    };
  }
);

/**
 * POST /api/coupon/my-invite
 * ログインユーザーの招待コードを取得（なければ発行）
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/coupon/my-invite",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { user }) => {
    const userId = user.userId;

    const inviteCode = await couponService.getOrCreateInviteCode(userId);

    return {
      inviteCode: {
        id: inviteCode.id,
        code: inviteCode.code,
        name: inviteCode.name,
        description: inviteCode.description,
        currentTotalUses: inviteCode.current_total_uses,
        maxTotalUses: inviteCode.max_total_uses,
        createdAt: inviteCode.createdAt,
      },
    };
  }
);
