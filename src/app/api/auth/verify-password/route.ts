// src/app/api/auth/verify-password/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { verifyCurrentUserPassword } from "@/features/core/auth/services/server/verifyCurrentUserPassword";

const VerifyPasswordPayloadSchema = z.object({
  password: z.string().min(1, "パスワードを入力してください"),
});

/**
 * 現在ログイン中のユーザーのパスワードを検証する
 * POST /api/auth/verify-password
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/verify-password",
    operationType: "read", // パスワード検証は読み取り操作
  },
  async (req, { session }) => {
    // ログインチェック
    if (!session) {
      return NextResponse.json(
        { message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    // リクエストボディをパース
    const json = await req.json();
    const parsed = VerifyPasswordPayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    // パスワードを検証
    const isValid = await verifyCurrentUserPassword(
      session.userId,
      parsed.data.password
    );

    if (!isValid) {
      return NextResponse.json(
        { message: "パスワードが正しくありません。", valid: false },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  }
);
