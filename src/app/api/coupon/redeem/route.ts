// src/app/api/coupon/redeem/route.ts
//
// 汎用（ゲスト可）のクーポン消込。受理するのは official 種別のみ。
// invite / affiliate は帰属報酬・紹介関係の副作用を伴う専用入口（登録フォーム、購入完了）を持つため、
// ここで生消込すると使用回数だけ消費されて副作用が走らない（報酬の逸失）。
// 種別に依存しない消込が必要になった場合は、専用ルート + scope 指定で追加すること。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { getCouponRedeemReasonMessage } from "@/features/core/coupon/constants/redeemReasonMessages";

/** 汎用消込が受理する種別。帰属付き種別（invite / affiliate）は専用入口のみ */
const GENERIC_REDEEM_SCOPE = { types: ["official"] } as const;

const RedeemCouponSchema = z.object({
  code: z.string().min(1, { message: "クーポンコードを指定してください。" }),
  additionalMetadata: z.record(z.unknown()).optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/coupon/redeem",
    operationType: "write",
    access: "custom",
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
      payload.additionalMetadata,
      undefined,
      { scope: GENERIC_REDEEM_SCOPE },
    );

    if (!result.success) {
      const message = getCouponRedeemReasonMessage(result.reason);
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
