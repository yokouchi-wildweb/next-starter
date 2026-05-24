// src/app/api/me/profile/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";

export const PATCH = createApiRoute(
  {
    operation: "PATCH /api/me/profile",
    operationType: "write",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です", { status: 401 });
    }

    const body = await req.json();

    // 名前・アバター・プロフィールデータを更新可能とする
    const updateData: Record<string, unknown> = {
      name: body.name,
    };

    if (body.avatarUrl !== undefined) {
      updateData.avatarUrl = body.avatarUrl;
    }

    if (body.profileData !== undefined) {
      updateData.profileData = body.profileData;
    }

    const updatedUser = await userService.update(session.userId, updateData);
    // 管理者専用 / セキュリティ内部フィールドは /me 経路から除外する。
    // - adminMemo: 本人が自分宛ての管理者メモを取得できないように
    // - failedLoginCount / lockedUntil / lastFailedLoginAt: ロック状態
    // - sessionsInvalidatedAt: セッション失効境界 (内部判定用)
    const {
      adminMemo: _adminMemo,
      failedLoginCount: _failedLoginCount,
      lockedUntil: _lockedUntil,
      lastFailedLoginAt: _lastFailedLoginAt,
      sessionsInvalidatedAt: _sessionsInvalidatedAt,
      ...selfVisibleUser
    } = updatedUser;
    return selfVisibleUser;
  },
);
