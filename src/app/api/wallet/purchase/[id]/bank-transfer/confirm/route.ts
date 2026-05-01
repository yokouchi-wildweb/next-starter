// src/app/api/wallet/purchase/[id]/bank-transfer/confirm/route.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込完了をユーザー自身が申告するエンドポイント。
//
// このプロバイダは外部 Webhook を持たないため、完了処理の起点はこの API になる。
// paymentConfig.bankTransfer.autoComplete:
//   - true  → completePurchase を直接呼び出し、即時に通貨を付与する。
//   - false → 管理者確認待ちフロー。今回スコープ外のため 501 を返す（別 PR で実装）。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { getBankTransferConfig } from "@/config/app/payment.config";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/core/purchaseRequest/services/server/payment/inhouse";

type Params = { id: string };

/**
 * 振込明細画像のメタデータ。
 * purchase_requests.metadata (JSONB) にマージして保存する。
 * 後から管理画面で照会・差戻し判定するための監査情報。
 */
const BANK_TRANSFER_PROOF_KEY = "bankTransferProof" as const;

const ConfirmBodySchema = z.object({
  /**
   * 振込明細の画像 URL（Firebase Storage にアップロード済みのもの）。
   * 事前に POST /api/storage/upload でアップロードして得た URL を渡す。
   */
  proofImageUrl: z
    .string()
    .min(1, { message: "振込明細画像が指定されていません。" })
    .url({ message: "画像 URL の形式が不正です。" }),
});

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/wallet/purchase/[id]/bank-transfer/confirm",
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

    // 1. 購入リクエストを取得（認可は別ユーザーの場合と存在しない場合を 404 で同一視して隠蔽）
    const purchaseRequest = await purchaseRequestService.get(id);
    if (!purchaseRequest || purchaseRequest.user_id !== session.userId) {
      return NextResponse.json(
        { message: "購入リクエストが見つかりません。" },
        { status: 404 },
      );
    }

    // 2. 自社銀行振込専用のエンドポイントなので、メソッド/プロバイダの整合をチェック
    if (
      purchaseRequest.payment_provider !== INHOUSE_PROVIDER_NAME ||
      purchaseRequest.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
    ) {
      return NextResponse.json(
        {
          message:
            "このリクエストは自社銀行振込ではありません。他の決済方法をご利用ください。",
        },
        { status: 400 },
      );
    }

    // 3. 既に完了済みなら冪等に成功を返す（連打・タブ複数開きの保険）
    if (purchaseRequest.status === "completed") {
      const slug = purchaseRequest.wallet_type
        ? getSlugByWalletType(purchaseRequest.wallet_type as WalletType)
        : "";
      return {
        success: true,
        requestId: purchaseRequest.id,
        alreadyCompleted: true,
        redirectUrl: slug
          ? `/wallet/${slug}/purchase/complete?request_id=${purchaseRequest.id}`
          : "",
      };
    }

    // 4. processing のみ受付。pending は決済セッション未確立なので不正経路、
    //    failed/expired は新規購入をやり直してもらう。
    if (purchaseRequest.status !== "processing") {
      return NextResponse.json(
        {
          message: `このリクエストは現在 ${purchaseRequest.status} 状態のため、振込完了を申告できません。`,
        },
        { status: 400 },
      );
    }

    // 5. 振込明細画像 URL を metadata にマージして保存
    //    completePurchase が失敗しても申告履歴は残る（運用上の監査情報として有用）。
    //    既存 metadata（purchase_type 固有情報）は維持する。
    const existingMetadata = (purchaseRequest.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const proofRecord = {
      proofImageUrl: body.proofImageUrl,
      submittedAt: new Date().toISOString(),
    };
    // metadata は CRUD update の generated 型に含まれていないため any キャスト
    // （initiatePurchase 内の既存パターンと同様）。
    await purchaseRequestService.update(purchaseRequest.id, {
      metadata: {
        ...existingMetadata,
        [BANK_TRANSFER_PROOF_KEY]: proofRecord,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // 6. 完了処理の分岐
    const bankTransferConfig = getBankTransferConfig();
    if (!bankTransferConfig.autoComplete) {
      // 管理者確認モード（今回スコープ外）。申告自体は記録済み（手順 5）。
      // 別 PR で「pending_review」相当のステータス追加 + 管理画面での承認ボタンを実装する。
      return NextResponse.json(
        {
          message:
            "振込完了の申告を受け付けました。管理者の確認後に通貨が付与されます（このフローは未実装です）。",
        },
        { status: 501 },
      );
    }

    // 7. 即時付与モード: completePurchase を直接呼び出して通貨を付与する
    //    sessionId は inhouseProvider.createSession で payment_session_id に保存した
    //    purchase_request.id（自社内発行）を渡す。findByWebhookIdentifier が
    //    payment_session_id 一致 → UUID 一致 の順で照合できるため確実にヒットする。
    const completion = await purchaseRequestService.completePurchase({
      sessionId: purchaseRequest.payment_session_id ?? purchaseRequest.id,
      paidAt: new Date(),
      // paidAmount は申告ベースのため検証しない（自己申告の偽装は事後の運用で対処する方針）。
      providerName: INHOUSE_PROVIDER_NAME,
    });

    const slug = completion.purchaseRequest.wallet_type
      ? getSlugByWalletType(completion.purchaseRequest.wallet_type as WalletType)
      : "";

    return {
      success: true,
      requestId: completion.purchaseRequest.id,
      walletHistoryId: completion.walletHistoryId,
      redirectUrl: slug
        ? `/wallet/${slug}/purchase/complete?request_id=${completion.purchaseRequest.id}`
        : "",
    };
  },
);
