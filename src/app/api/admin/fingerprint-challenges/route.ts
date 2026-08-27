// src/app/api/admin/fingerprint-challenges/route.ts
//
// 管理者向け: チャレンジ発行 API。
// 生トークンはこのレスポンスでのみ取得できる (DB には SHA-256 のみ保存)。
// downstream のフォームページ URL にトークンを埋めてユーザーへ案内する
// (レシピ: src/features/core/fingerprintChallenge/README.md)。
// 一覧・検索は serviceRegistry (fingerprintChallenge, ADMIN_ONLY) の汎用 API を使う。

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";
import { IssueChallengeSchema } from "@/features/core/fingerprintChallenge/entities/schema";
import { issueChallenge } from "@/features/core/fingerprintChallenge/services/server";
import { userService } from "@/features/core/user/services/server/userService";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/fingerprint-challenges",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { session }) => {
    if (!FINGERPRINT_CONFIG.challenge.enabled) {
      throw new DomainError(
        "チャレンジ機能が無効です (FINGERPRINT_CONFIG.challenge.enabled)",
        { status: 404 },
      );
    }

    const parsed = IssueChallengeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }

    const targetUser = await userService.get(parsed.data.userId);
    if (!targetUser) {
      throw new DomainError("対象ユーザーが見つかりません", { status: 404 });
    }

    const { challenge, token } = await issueChallenge({
      ...parsed.data,
      issuedBy: session?.userId ?? null,
    });

    return { challenge, token };
  },
);
