// 管理者用: 指定ユーザーの紹介一覧を取得

import { NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { referralService } from "@/features/core/referral/services/server/referralService";
import { referralRewardService } from "@/features/core/referralReward/services/server/referralRewardService";
import { REFERRAL_REWARD_DEFINITIONS } from "@/features/core/referralReward/config";
import { getRewardGroupKey } from "@/features/core/referralReward/utils/rewardDefinitionLookup";
import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { inArray } from "drizzle-orm";
import type { UserMetadata } from "@/features/core/user/entities/model";

type RouteParams = { userId: string };

export const GET = createApiRoute<RouteParams>(
  {
    operation: "GET /api/admin/referral/by-inviter/[userId]",
    operationType: "read",
  },
  async (_req, { session, params }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { userId } = await params;

    const referrals = await referralService.getByInviter(userId, { activeOnly: false });

    // 被招待者のユーザー名を一括取得
    const inviteeIds = referrals.map((r) => r.invitee_user_id);
    let nameMap = new Map<string, string | null>();
    let metadataMap = new Map<string, UserMetadata>();

    if (inviteeIds.length > 0) {
      const users = await db
        .select({ id: UserTable.id, name: UserTable.name, metadata: UserTable.metadata })
        .from(UserTable)
        .where(inArray(UserTable.id, inviteeIds));
      nameMap = new Map(users.map((u) => [u.id, u.name]));
      metadataMap = new Map(users.map((u) => [u.id, u.metadata]));
    }

    // 各 referral に紐づく reward を一括取得し、達成済みグループラベルを算出
    const referralIds = referrals.map((r) => r.id);
    const rewardGroupsMap = new Map<string, string[]>();

    if (referralIds.length > 0) {
      const allRewards = await Promise.all(
        referralIds.map((id) => referralRewardService.getByReferral(id))
      );

      for (let i = 0; i < referrals.length; i++) {
        const rewards = allRewards[i];
        // fulfilled な reward のグループラベルを重複排除で収集
        const groupLabels = new Set<string>();
        for (const reward of rewards) {
          if (reward.status !== "fulfilled") continue;
          const groupKey = getRewardGroupKey(reward.reward_key);
          if (groupKey) {
            const group = REFERRAL_REWARD_DEFINITIONS[groupKey];
            if (group) groupLabels.add(group.label);
          }
        }
        rewardGroupsMap.set(referrals[i].id, [...groupLabels]);
      }
    }

    return {
      referrals: referrals.map((r) => ({
        id: r.id,
        inviteeUserId: r.invitee_user_id,
        inviteeUserName: nameMap.get(r.invitee_user_id) ?? null,
        signupIp: metadataMap.get(r.invitee_user_id)?.signupIp ?? null,
        status: r.status,
        createdAt: r.createdAt,
        fulfilledRewardGroups: rewardGroupsMap.get(r.id) ?? [],
      })),
    };
  }
);
