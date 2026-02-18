// src/app/api/coupon/check-usability/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { couponService } from "@/features/core/coupon/services/server/couponService";

const CheckUsabilitySchema = z.object({
  code: z.string().min(1, { message: "クーポンコードを指定してください。" }),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/coupon/check-usability",
    operationType: "read",
    skipForDemo: false,
  },
  async (req, { session }) => {
    let payload: z.infer<typeof CheckUsabilitySchema>;
    try {
      const json = await req.json();
      const parsed = CheckUsabilitySchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    // セッションがあればユーザーID、なければ null（ゲストチェック）
    const redeemerUserId = session?.userId ?? null;

    const result = await couponService.isUsable(payload.code, redeemerUserId);

    if (!result.usable) {
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
      return {
        usable: false,
        reason: result.reason,
        message,
        // クーポン情報は返さない（セキュリティ上）
      };
    }

    // 使用可能な場合、クーポンの基本情報を返す
    return {
      usable: true,
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        category: result.coupon.category,
        name: result.coupon.name,
        description: result.coupon.description,
        image_url: result.coupon.image_url,
      },
    };
  }
);
