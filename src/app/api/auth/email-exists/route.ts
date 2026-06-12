// src/app/api/auth/email-exists/route.ts
//
// サインアップ用: メールアドレスが「登録済みユーザー」として存在するかを boolean で返す。
// 未認証で叩く公開エンドポイントだが、PII を返さない（exists のみ）。
// 汎用 /api/user/search を未認証に開放するとユーザー列挙・PII 漏洩になるため、
// 用途を絞ったこの専用ルートで提供する。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { isUserStatusRegistered } from "@/features/core/user/utils/status";

const RequestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/email-exists",
    operationType: "read",
    access: "public",
    skipForDemo: false,
    // 列挙対策のレート制限（boolean しか返さないが乱用は防ぐ）
    rateLimit: "apiGeneral",
  },
  async (req) => {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message ?? "メールアドレスが不正です" },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // email プロバイダの登録済みユーザーのみを対象に存在判定する
    const { results } = await userService.search({
      limit: 1,
      where: {
        and: [
          { field: "providerType", op: "eq", value: "email" },
          { field: "email", op: "eq", value: email },
        ],
      },
    });

    const found = results[0] ?? null;
    const exists = found ? isUserStatusRegistered(found.status) : false;

    return { exists };
  },
);
