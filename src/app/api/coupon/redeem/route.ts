// src/app/api/coupon/redeem/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { couponService } from "@/features/core/coupon/services/server/couponService";

const RedeemCouponSchema = z.object({
  code: z.string().min(1, { message: "クーポンコードを指定してください。" }),
  additionalMetadata: z.record(z.unknown()).optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/coupon/redeem",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    let payload: z.infer<typeof RedeemCouponSchema>;
    try {
      const json = await req.json();
      const parsed = RedeemCouponSchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    // セッションがあればユーザーID、なければ null（ゲスト使用）
    const redeemerUserId = session?.userId ?? null;

    const result = await couponService.redeem(
      payload.code,
      redeemerUserId,
      payload.additionalMetadata
    );

    if (!result.success) {
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
      const message = messages[result.reason] ?? "クーポンを使用できません。";
      return NextResponse.json(
        { success: false, reason: result.reason, message },
        { status: 400 }
      );
    }

    return {
      success: true,
      history: result.history,
    };
  }
);
