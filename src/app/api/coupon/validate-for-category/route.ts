// カテゴリ付きクーポン検証API
//
// クーポンの基本検証 + カテゴリ一致 + ハンドラーの追加検証 + 効果プレビューを返す。
// 購入フローでクーポンコード入力時にクライアントから呼び出される。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { couponService } from "@/features/core/coupon/services/server/couponService";

const ValidateForCategorySchema = z.object({
  code: z.string().min(1, { message: "クーポンコードを指定してください。" }),
  category: z.string().min(1, { message: "カテゴリを指定してください。" }),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/coupon/validate-for-category",
    operationType: "read",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    let payload: z.infer<typeof ValidateForCategorySchema>;
    try {
      const json = await req.json();
      const parsed = ValidateForCategorySchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    const result = await couponService.validateForCategory(
      payload.code,
      payload.category,
      session.userId,
      payload.metadata,
    );

    if (!result.valid) {
      const messages: Record<string, string> = {
        not_found: "クーポンが見つかりません。",
        inactive: "このクーポンは無効です。",
        not_started: "このクーポンはまだ使用開始前です。",
        expired: "このクーポンは有効期限切れです。",
        max_total_reached: "このクーポンの使用上限に達しました。",
        max_per_user_reached: "このクーポンの使用上限に達しました。",
        user_id_required: "このクーポンを使用するにはログインが必要です。",
        category_mismatch: "このクーポンはこの用途には使用できません。",
        handler_rejected: "このクーポンの使用条件を満たしていません。",
      };
      const message = messages[result.reason] ?? result.reason ?? "クーポンを使用できません。";
      return {
        valid: false,
        reason: result.reason,
        message,
      };
    }

    return {
      valid: true,
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        category: result.coupon.category,
        name: result.coupon.name,
        description: result.coupon.description,
        image_url: result.coupon.image_url,
      },
      effect: result.effect,
    };
  },
);
