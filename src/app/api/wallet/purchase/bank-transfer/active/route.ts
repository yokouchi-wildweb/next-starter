// src/app/api/wallet/purchase/bank-transfer/active/route.ts
//
// 認証ユーザーの「現在進行中の自社銀行振込」を 1 件返す。
// UI の「進行中振込バナー」と「購入確認画面の再開ボタン」用。
//
// 検出順序:
// 1. pending_review / needs_check のレビュー（申告済みで管理者待ち、または再申告可能な状態）
// 2. それが無ければ、申告前の processing 中 purchase_request（振込前で案内ページへ戻したいケース）
//
// inhouseProvider.validateInitiation で同一ユーザーの未完了銀行振込は 1 件に制限しているため、
// 結果は最大 1 件。confirmed / rejected の確定済みレビューは検出対象外（バナー表示不要）。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import type {
  BankTransferReviewMode,
  BankTransferReviewStatus,
} from "@/features/bankTransferReview/entities/model";

/**
 * UI 側の「現在この振込はどの段階か」表示用ステータス。
 * - pre_submit: 振込前（ユーザーがまだ画像を申告していない）
 * - pending_review: 申告済み・管理者の判定待ち（再申告も可能）
 * - needs_check: AI 判定不合格のまま申告済み・管理者の確認待ち（再申告も可能）
 *
 * investigating / confirmed / rejected はバナー表示対象外なのでここに含めない。
 */
type ActiveStatus =
  | "pre_submit"
  | Extract<BankTransferReviewStatus, "pending_review" | "needs_check">;

type ActiveBankTransferResponse =
  | {
      active: null;
    }
  | {
      active: {
        purchaseRequestId: string;
        reviewId: string | null;
        status: ActiveStatus;
        /** 申告前は null、申告後はレビュー作成時に確定したモード */
        mode: BankTransferReviewMode | null;
        submittedAt: string | null;
        /** 状態に応じた誘導先 URL（振込案内 / 確認待ち / 完了画面） */
        redirectUrl: string;
      };
    };

function buildRedirectUrl(
  walletType: WalletType | null,
  purchaseRequestId: string,
  status: ActiveStatus,
  mode: BankTransferReviewMode | null,
): string {
  if (!walletType) return "";
  const slug = getSlugByWalletType(walletType);

  if (status === "pre_submit") {
    return `/wallet/${slug}/purchase/bank-transfer/${purchaseRequestId}`;
  }

  // status === "pending_review" / "needs_check" + purchase_request.status=processing が
  // 確定している (findActiveByUser が JOIN で絞り込み済み)。
  //
  // - mode=approval_required: 管理者承認待ち（needs_check 含む）→ 確認待ちページに誘導
  // - mode=immediate: 申告は受け付けたが completePurchase が失敗して通貨未付与の
  //   異常状態。振込案内ページに戻して再申告（画像差し替えで completePurchase 再試行）
  //   で回復させる。UI 側はレスポンスの mode を見て「再申告が必要」のメッセージを
  //   出し分けることを推奨。
  if (mode === "approval_required") {
    return `/wallet/${slug}/purchase/awaiting-review?request_id=${purchaseRequestId}`;
  }
  return `/wallet/${slug}/purchase/bank-transfer/${purchaseRequestId}`;
}

export const GET = createApiRoute(
  {
    operation: "GET /api/wallet/purchase/bank-transfer/active",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }): Promise<ActiveBankTransferResponse | NextResponse> => {
    // 検出(レビュー優先 → 申告前の processing 中 purchase_request)は bankTransferReviewService.findActiveBankTransfer
    const active = await bankTransferReviewService.findActiveBankTransfer(user.userId);
    if (!active) {
      return { active: null };
    }

    if (active.kind === "review") {
      const { review } = active;
      const walletType = active.walletType as WalletType | null;
      // findActiveByUser は pending_review / needs_check のみ返すため、この絞り込みで
      // ActiveStatus に安全に変換できる。
      const activeStatus: ActiveStatus =
        review.status === "needs_check" ? "needs_check" : "pending_review";

      return {
        active: {
          purchaseRequestId: review.purchase_request_id,
          reviewId: review.id,
          status: activeStatus,
          mode: review.mode,
          submittedAt: review.submitted_at.toISOString(),
          redirectUrl: buildRedirectUrl(
            walletType,
            review.purchase_request_id,
            activeStatus,
            review.mode,
          ),
        },
      };
    }

    const walletType = active.walletType as WalletType | null;
    return {
      active: {
        purchaseRequestId: active.purchaseRequestId,
        reviewId: null,
        status: "pre_submit",
        mode: null,
        submittedAt: null,
        redirectUrl: buildRedirectUrl(walletType, active.purchaseRequestId, "pre_submit", null),
      },
    };
  },
);
