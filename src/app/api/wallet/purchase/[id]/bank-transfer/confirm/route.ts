// src/app/api/wallet/purchase/[id]/bank-transfer/confirm/route.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込完了をユーザー自身が申告するエンドポイント。
//
// このプロバイダは外部 Webhook を持たないため、完了処理の起点はこの API になる。
// bankTransferReviewService.submitReview がレビューレコード作成 + mode 判定 +
// 即時モード時の completePurchase 呼び出しを一括で処理する。
//
// レスポンスの redirectUrl は mode に応じて UI 側の遷移先を変える:
//   - immediate: /wallet/[slug]/purchase/complete (通貨付与済み)
//   - approval_required: /wallet/[slug]/purchase/awaiting-review (管理者確認待ちページ)

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";
import { purchaseRequestService } from "@/features/purchaseRequest/services/server/purchaseRequestService";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";

type Params = { id: string };

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

/**
 * mode に応じた遷移先 URL を組み立てる。
 * walletType が無いケース（direct_sale 等）では空文字を返し、UI 側でフォールバックさせる。
 */
function buildRedirectUrl(
  walletType: WalletType | null,
  requestId: string,
  mode: "immediate" | "approval_required",
): string {
  if (!walletType) return "";
  const slug = getSlugByWalletType(walletType);
  const path =
    mode === "immediate"
      ? `complete?request_id=${requestId}`
      : `awaiting-review?request_id=${requestId}`;
  return `/wallet/${slug}/purchase/${path}`;
}

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

    // submitReview がメソッド/プロバイダ整合 + status 検証 + 既存レビュー確認 +
    // mode 決定 + レビュー作成 + 即時モード時の completePurchase まで全部やる。
    // DomainError はそのまま createApiRoute の共通ハンドラが status 付きで返す。
    const result = await bankTransferReviewService.submitReview({
      purchaseRequestId: id,
      userId: session.userId,
      proofImageUrl: body.proofImageUrl,
    });

    // walletType を取得して redirectUrl を組み立てる。
    // 即時モードの再申告（既に completed）でも、レビュー作成・mode 判定は走るので
    // result が返る。alreadyCompleted=true の場合も同じ完了画面に飛ばす。
    const purchaseRequest = await purchaseRequestService.get(
      result.review.purchase_request_id,
    );
    const redirectUrl = buildRedirectUrl(
      (purchaseRequest?.wallet_type ?? null) as WalletType | null,
      result.review.purchase_request_id,
      result.mode,
    );

    return {
      success: true,
      requestId: result.review.purchase_request_id,
      reviewId: result.review.id,
      mode: result.mode,
      walletHistoryId: result.walletHistoryId,
      alreadyCompleted: result.alreadyCompleted,
      redirectUrl,
    };
  },
);
