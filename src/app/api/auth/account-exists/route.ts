// src/app/api/auth/account-exists/route.ts
//
// OAuth ログイン用: providerType + providerUid の登録済みユーザーが存在するかを boolean で返す。
// 未認証で叩く公開エンドポイントだが、PII を返さない（exists のみ）。
// 汎用 /api/user/search を未認証に開放するとユーザー列挙・PII 漏洩になるため、
// 用途を絞ったこの専用ルートで提供する。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { isUserStatusRegistered } from "@/features/core/user/utils/status";

const RequestSchema = z.object({
  providerType: z.string().min(1),
  providerUid: z.string().min(1),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/account-exists",
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
      return NextResponse.json({ message: "リクエストが不正です" }, { status: 400 });
    }

    const { providerType, providerUid } = parsed.data;

    const { results } = await userService.search({
      limit: 1,
      where: {
        and: [
          { field: "providerType", op: "eq", value: providerType },
          { field: "providerUid", op: "eq", value: providerUid },
        ],
      },
    });

    const found = results[0] ?? null;
    const exists = found ? isUserStatusRegistered(found.status) : false;

    return { exists };
  },
);
