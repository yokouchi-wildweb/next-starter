// src/app/api/me/email/send-verification/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { sendEmailChangeLink } from "@/features/core/auth/services/server/sendEmailChangeLink";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";

const RequestSchema = z.object({
  newEmail: z.string().email("有効なメールアドレスを入力してください"),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/me/email/send-verification",
    operationType: "write",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です", { status: 401 });
    }

    const body = await req.json();
    const result = RequestSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.errors[0]?.message ?? "入力値が不正です";
      return NextResponse.json({ message }, { status: 400 });
    }

    const { newEmail } = result.data;

    // 現在のユーザー情報を取得
    const currentUser = await userService.get(session.userId);
    if (!currentUser) {
      throw new DomainError("ユーザーが見つかりません", { status: 404 });
    }

    if (!currentUser.email) {
      throw new DomainError("現在のメールアドレスが設定されていません", { status: 400 });
    }

    if (currentUser.email === newEmail) {
      throw new DomainError("新しいメールアドレスが現在と同じです", { status: 400 });
    }

    // 同じメールアドレスを持つユーザーがいないか確認
    const { total: existingCount } = await userService.search({
      where: { field: "email", op: "eq", value: newEmail },
      limit: 1,
    });

    if (existingCount > 0) {
      throw new DomainError("このメールアドレスは既に使用されています", { status: 409 });
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    await sendEmailChangeLink({
      currentEmail: currentUser.email,
      newEmail,
      origin,
    });

    return { success: true };
  },
);
