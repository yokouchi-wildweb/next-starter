// src/app/api/wallet/purchase/[id]/paypal/confirm/route.ts
//
// PayPal (client_sdk 起動方式) の決済完了をクライアントから確定するエンドポイント。
//
// クライアント側の clientSdkHandler が PayPal ボタンの onApprove で受け取った
// order_id を providerPaymentId として送る。サービス層 (confirmPayPalPayment) が
// PayPal API 再確認 + capture + completePurchase + auditLogger まで一括処理する。
//
// レスポンスは clientSdkHandler が成否のみ参照する想定で、successUrl への遷移は
// クライアント側で行う。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { confirmPayPalPayment } from "@/features/core/purchaseRequest/services/server/payment/paypal/confirmPayPalPayment";

type Params = { id: string };

const ConfirmBodySchema = z.object({
  /**
   * PayPal の order_id（onApprove の data.orderID）。
   * サーバー側で createSession 時に payment_session_id に保存したものと一致し、
   * PayPal API に再問い合わせして amount / status を検証する。
   */
  providerPaymentId: z
    .string()
    .min(1, { message: "providerPaymentId が指定されていません。" })
    .max(64, { message: "providerPaymentId の形式が不正です。" })
    .regex(/^[A-Za-z0-9_-]+$/, { message: "providerPaymentId の形式が不正です。" }),
});

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/wallet/purchase/[id]/paypal/confirm",
    operationType: "write",
  },
  async (req, { params, session }) => {
    const { id } = params;

    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json(
        { message: "リクエスト ID が指定されていません。" },
        { status: 400 },
      );
    }

    let body: z.infer<typeof ConfirmBodySchema>;
    try {
      const json = await req.json();
      const parsed = ConfirmBodySchema.safeParse(json);
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message }, { status: 400 });
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { message: "リクエストボディの解析に失敗しました。" },
        { status: 400 },
      );
    }

    // confirmPayPalPayment が認可 / 状態 / amount / capture / completePurchase / 監査ログまで一括処理。
    // DomainError はそのまま createApiRoute の共通ハンドラが status 付きで返す。
    const result = await confirmPayPalPayment({
      purchaseRequestId: id,
      userId: session.userId,
      providerPaymentId: body.providerPaymentId,
    });

    return {
      success: true,
      requestId: result.purchaseRequest.id,
      walletHistoryId: result.walletHistoryId,
      alreadyCompleted: result.alreadyCompleted,
    };
  },
);
