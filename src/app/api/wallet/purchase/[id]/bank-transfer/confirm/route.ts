// src/app/api/wallet/purchase/[id]/bank-transfer/confirm/route.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込完了をユーザー自身が申告するエンドポイント。
//
// このプロバイダは外部 Webhook を持たないため、完了処理の起点はこの API になる。
// bankTransferReviewService.submitReview がレビューレコード作成 + mode 判定 +
// 即時モード時の completePurchase 呼び出しを一括で処理する。
//
// レスポンスの redirectUrl は通貨付与の有無に応じて UI 側の遷移先を変える:
//   - 付与済み (即時モードで付与完了): /wallet/[slug]/purchase/complete
//   - 未付与 (管理者確認待ち / AI 判定不合格による要確認): /wallet/[slug]/purchase/awaiting-review
//
// AI 画像判定が有効な構成では、submitReview がサーバー保存の判定結果を検証する。
// 不合格・未判定のまま申告する場合は body.unverifiedNote (振込人名等のメモ) が必須で、
// レビューは needs_check として登録され通貨は付与されない (管理者承認時に付与)。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { storageMediaValueSchema } from "@/lib/storage";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";
import { purchaseRequestService } from "@/features/purchaseRequest/services/server/purchaseRequestService";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";

type Params = { id: string };

const ConfirmBodySchema = z.object({
  /**
   * 振込明細画像の storage ref（用途 purchaseRequest.bankProof）。
   * 事前に useBankTransferProofUpload（purchaseRequest/hooks）でアップロードして得た ref を渡す。
   * 保存時に bankTransferReview の storage binding が「本人・同じ依頼・未紐付け」を確かめて紐付ける。
   */
  proofImageUrl: z
    .string()
    .min(1, { message: "振込明細画像が指定されていません。" })
    .pipe(storageMediaValueSchema),
  /**
   * AI 判定が不承認のまま申告する場合の、入金確認のための振込人名等メモ。
   * 必須かどうかはサーバー保存の判定結果に基づき submitReview 側で検証する
   * （不合格・未判定の申告では必須）。
   */
  unverifiedNote: z
    .string()
    .trim()
    .max(500, { message: "メモは500文字以内で入力してください。" })
    .optional(),
});

/**
 * 通貨付与の有無に応じた遷移先 URL を組み立てる。
 * 付与済み（即時モードで付与完了 / 付与済みの再申告）なら完了画面、
 * それ以外（管理者確認待ち・要確認）は確認待ち画面。
 * walletType が無いケース（direct_sale 等）では空文字を返し、UI 側でフォールバックさせる。
 */
function buildRedirectUrl(
  walletType: WalletType | null,
  requestId: string,
  granted: boolean,
): string {
  if (!walletType) return "";
  const slug = getSlugByWalletType(walletType);
  const path = granted
    ? `complete?request_id=${requestId}`
    : `awaiting-review?request_id=${requestId}`;
  return `/wallet/${slug}/purchase/${path}`;
}

export const POST = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "POST /api/wallet/purchase/[id]/bank-transfer/confirm",
    operationType: "write",
    access: "authenticated",
  },
  async (req, { params, user }) => {
    const { id } = params;

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
      userId: user.userId,
      proofImageUrl: body.proofImageUrl,
      unverifiedNote: body.unverifiedNote ?? null,
    });

    // walletType を取得して redirectUrl を組み立てる。
    // 即時モードの再申告（既に completed）でも、レビュー作成・mode 判定は走るので
    // result が返る。alreadyCompleted=true の場合も同じ完了画面に飛ばす。
    // 即時モードでも判定不合格の申告では付与されないため、mode ではなく
    // 「実際に付与済みか」で完了画面 / 確認待ち画面を出し分ける。
    const purchaseRequest = await purchaseRequestService.get(
      result.review.purchase_request_id,
    );
    const granted =
      result.mode === "immediate" &&
      (result.walletHistoryId !== null || result.alreadyCompleted);
    const redirectUrl = buildRedirectUrl(
      (purchaseRequest?.wallet_type ?? null) as WalletType | null,
      result.review.purchase_request_id,
      granted,
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
