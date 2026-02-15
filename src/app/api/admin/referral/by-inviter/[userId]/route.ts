// 管理者用: 指定ユーザーの紹介一覧を取得

import { NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { referralService } from "@/features/core/referral/services/server/referralService";
import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { inArray } from "drizzle-orm";

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

    // 被招待者のユーザー名を一括取得
    const inviteeIds = referrals.map((r) => r.invitee_user_id);
    let nameMap = new Map<string, string | null>();

    if (inviteeIds.length > 0) {
      const users = await db
        .select({ id: UserTable.id, name: UserTable.name })
        .from(UserTable)
        .where(inArray(UserTable.id, inviteeIds));
      nameMap = new Map(users.map((u) => [u.id, u.name]));
    }

    return {
      referrals: referrals.map((r) => ({
        id: r.id,
        inviteeUserId: r.invitee_user_id,
        inviteeUserName: nameMap.get(r.invitee_user_id) ?? null,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }
);
