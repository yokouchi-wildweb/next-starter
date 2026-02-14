// 管理者用: 指定ユーザーの紹介一覧を取得

import { NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { referralService } from "@/features/core/referral/services/server/referralService";

type RouteParams = { userId: string };

export const GET = createApiRoute<RouteParams>(
  {
    operation: "GET /api/admin/referral/by-inviter/[userId]",
    operationType: "read",
  },
  async (_req, { session, params }) => {
    if (!session || session.role !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { userId } = await params;

    const referrals = await referralService.getByInviter(userId, { activeOnly: false });

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
