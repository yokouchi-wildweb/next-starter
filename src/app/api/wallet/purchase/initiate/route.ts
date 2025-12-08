// src/app/api/wallet/purchase/initiate/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { isDomainError } from "@/lib/errors";

/**
 * 購入開始リクエストのスキーマ
 */
const InitiatePurchaseSchema = z.object({
  idempotencyKey: z.string().uuid({ message: "冪等キーはUUID形式で指定してください。" }),
  walletType: z.enum(["regular_point", "temporary_point", "regular_coin"], {
    errorMap: () => ({ message: "無効なウォレット種別です。" }),
  }),
  amount: z.coerce.number().int().positive({ message: "購入数量は1以上の整数で指定してください。" }),
  paymentAmount: z.coerce.number().int().positive({ message: "支払い金額は1以上の整数で指定してください。" }),
  paymentMethod: z.string().min(1, { message: "支払い方法を指定してください。" }),
});

/**
 * POST /api/wallet/purchase/initiate
 * 購入を開始し、決済ページへのリダイレクトURLを返す
 */
export async function POST(req: NextRequest) {
  // 1. 認証チェック
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { message: "ログインが必要です。" },
      { status: 401 }
    );
  }

  // 2. リクエストボディの解析
  let payload: z.infer<typeof InitiatePurchaseSchema>;
  try {
    const json = await req.json();
    const parsed = InitiatePurchaseSchema.safeParse(json);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json(
      { message: "リクエストボディの解析に失敗しました。" },
      { status: 400 }
    );
  }

  // 3. 購入処理の開始
  try {
    // ベースURLを取得（リダイレクト先URL生成用）
    const baseUrl = getBaseUrl(req);

    const result = await purchaseRequestService.initiatePurchase({
      userId: sessionUser.userId,
      idempotencyKey: payload.idempotencyKey,
      walletType: payload.walletType,
      amount: payload.amount,
      paymentAmount: payload.paymentAmount,
      paymentMethod: payload.paymentMethod,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      requestId: result.purchaseRequest.id,
      redirectUrl: result.redirectUrl,
      alreadyProcessing: result.alreadyProcessing ?? false,
      alreadyCompleted: result.alreadyCompleted ?? false,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("POST /api/wallet/purchase/initiate failed:", error);
    return NextResponse.json(
      { message: "購入処理の開始に失敗しました。" },
      { status: 500 }
    );
  }
}

/**
 * リクエストからベースURLを取得
 */
function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
