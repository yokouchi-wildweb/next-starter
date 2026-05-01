// src/app/api/wallet/purchase/bank-transfer/active/route.ts
//
// 認証ユーザーの「現在進行中の自社銀行振込」を 1 件返す。
// UI の「進行中振込バナー」と「購入確認画面の再開ボタン」用。
//
// 検出順序:
// 1. pending_review のレビュー（申告済みで管理者待ち、または再申告可能な状態）
// 2. それが無ければ、申告前の processing 中 purchase_request（振込前で案内ページへ戻したいケース）
//
// inhouseProvider.validateInitiation で同一ユーザーの未完了銀行振込は 1 件に制限しているため、
// 結果は最大 1 件。confirmed / rejected の確定済みレビューは検出対象外（バナー表示不要）。

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { db } from "@/lib/drizzle";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/core/purchaseRequest/services/server/payment/inhouse";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import type {
  BankTransferReviewMode,
  BankTransferReviewStatus,
} from "@/features/bankTransferReview/entities/model";

/**
 * UI 側の「現在この振込はどの段階か」表示用ステータス。
 * - pre_submit: 振込前（ユーザーがまだ画像を申告していない）
 * - pending_review: 申告済み・管理者の判定待ち（再申告も可能）
 *
 * confirmed / rejected はバナー表示対象外なのでここに含めない。
 */
type ActiveStatus = "pre_submit" | Extract<BankTransferReviewStatus, "pending_review">;

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
): string {
  if (!walletType) return "";
  const slug = getSlugByWalletType(walletType);

  if (status === "pre_submit") {
    return `/wallet/${slug}/purchase/bank-transfer/${purchaseRequestId}`;
  }

  // status === "pending_review"
  // findActiveByUser が mode=approval_required のみを返すため、ここに到達するのは
  // 確認モードの確認待ちレビューだけ（immediate モードは申告完了時点で
  // ユーザー視点では完了扱いとなり active 検出対象外）。
  // 詳細: findHelpers.ts の findActiveByUser コメント参照
  return `/wallet/${slug}/purchase/awaiting-review?request_id=${purchaseRequestId}`;
}

export const GET = createApiRoute(
  {
    operation: "GET /api/wallet/purchase/bank-transfer/active",
    operationType: "read",
  },
  async (_req, { session }): Promise<ActiveBankTransferResponse | NextResponse> => {
    if (!session) {
      return NextResponse.json(
        { message: "ログインが必要です。" },
        { status: 401 },
      );
    }

    // 1. pending_review レビューを優先して検出
    const review = await bankTransferReviewService.findActiveByUser(session.userId);
    if (review) {
      const purchaseRequest = await db
        .select({
          wallet_type: PurchaseRequestTable.wallet_type,
        })
        .from(PurchaseRequestTable)
        .where(eq(PurchaseRequestTable.id, review.purchase_request_id))
        .limit(1);
      const walletType = (purchaseRequest[0]?.wallet_type ?? null) as WalletType | null;

      return {
        active: {
          purchaseRequestId: review.purchase_request_id,
          reviewId: review.id,
          status: "pending_review",
          mode: review.mode,
          submittedAt: review.submitted_at.toISOString(),
          redirectUrl: buildRedirectUrl(
            walletType,
            review.purchase_request_id,
            "pending_review",
          ),
        },
      };
    }

    // 2. 申告前の processing 中 purchase_request を検出
    //    inhouseProvider.validateInitiation の制限により最大 1 件。
    const rows = await db
      .select()
      .from(PurchaseRequestTable)
      .where(
        and(
          eq(PurchaseRequestTable.user_id, session.userId),
          eq(PurchaseRequestTable.payment_provider, INHOUSE_PROVIDER_NAME),
          eq(PurchaseRequestTable.payment_method, INHOUSE_BANK_TRANSFER_METHOD_ID),
          eq(PurchaseRequestTable.status, "processing"),
        ),
      )
      .orderBy(desc(PurchaseRequestTable.createdAt))
      .limit(1);

    const pr = rows[0];
    if (!pr) {
      return { active: null };
    }

    const walletType = pr.wallet_type as WalletType | null;
    return {
      active: {
        purchaseRequestId: pr.id,
        reviewId: null,
        status: "pre_submit",
        mode: null,
        submittedAt: null,
        redirectUrl: buildRedirectUrl(walletType, pr.id, "pre_submit"),
      },
    };
  },
);
