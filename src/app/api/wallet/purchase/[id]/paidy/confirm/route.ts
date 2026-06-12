// src/app/api/wallet/purchase/[id]/paidy/confirm/route.ts
//
// Paidy (client_sdk 起動方式) の決済完了をクライアントから確定するエンドポイント。
//
// クライアント側の clientSdkHandler が paidy.js の closed コールバックで
// status === AUTHORIZED を受け取った時に呼び出す。サービス層
// (confirmPaidyPayment) が Paidy API 再問い合わせ + capture + completePurchase
// + auditLogger まで一括で処理する。
//
// レスポンスは clientSdkHandler が成否のみ参照する想定で、successUrl への遷移は
// クライアント側で行う（成功時に window.location.href = successUrl）。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { confirmPaidyPayment } from "@/features/core/purchaseRequest/services/server/payment/paidy/confirmPaidyPayment";

type Params = { id: string };

const ConfirmBodySchema = z.object({
  /**
   * paidy.js の closed コールバックで受け取った payment_id（"pay_..."）。
   * サーバー側で Paidy API に再問い合わせし、amount / status を検証する。
   */
  providerPaymentId: z
    .string()
    .min(1, { message: "providerPaymentId が指定されていません。" })
    .regex(/^pay_/, { message: "providerPaymentId の形式が不正です。" }),
});

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/wallet/purchase/[id]/paidy/confirm",
    operationType: "write",
    access: "custom",
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

    // confirmPaidyPayment が認可 / 状態 / amount / capture / completePurchase / 監査ログまで一括処理。
    // DomainError はそのまま createApiRoute の共通ハンドラが status 付きで返す。
    const result = await confirmPaidyPayment({
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
