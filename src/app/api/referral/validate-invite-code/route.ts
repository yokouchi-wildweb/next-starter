// src/app/api/referral/validate-invite-code/route.ts
//
// サインアップフォーム用: 入力された招待コードが有効かをログイン前に返す。
//
// - 未認証で叩ける公開エンドポイント。レスポンスは valid と文言のみで、
//   理由（not_found / expired / 種別違い 等）は区別させない（コード存在の列挙対策）。
// - クーポン情報（名前・発行者 等）も返さない。招待者名の表示は下流が必要に応じて
//   自前ルートで実装する（未認証で「コード → 表示名」が引けるのは PII 露出のため core は持たない）。
// - レートリミットで総当たりを抑止する。
// - referral 機能が無効な環境では常に invalid。

import { NextResponse } from "next/server";
import { z } from "zod";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { createApiRoute } from "@/lib/routeFactory";
import { INVITE_CODE_INVALID_MESSAGE } from "@/features/core/referral/constants/inviteCodeValidation";
import { referralService } from "@/features/core/referral/services/server/referralService";

const RequestSchema = z.object({
  code: z.string().trim().min(1, { message: "招待コードを指定してください。" }),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/referral/validate-invite-code",
    operationType: "read",
    access: "public",
    skipForDemo: false,
    rateLimit: "apiGeneral",
  },
  async (req) => {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message }, { status: 400 });
    }

    if (!APP_FEATURES.marketing.referral.enabled) {
      return { valid: false, message: INVITE_CODE_INVALID_MESSAGE };
    }

    const result = await referralService.validateInviteCode(parsed.data.code);

    if (!result.valid) {
      return { valid: false, message: INVITE_CODE_INVALID_MESSAGE };
    }

    return { valid: true };
  },
);
