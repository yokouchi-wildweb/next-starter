// src/features/core/bankTransferReview/services/server/wrappers/submitReview.ts
//
// ユーザーが「振込完了しました」と申告したときに呼ばれるサービス。
//
// 動作:
// - 既存レビューが無ければ pending_review で新規作成
// - 既存レビューが pending_review なら画像 URL を差し替えて再申告として扱う
// - 既存レビューが confirmed / rejected なら 400 (既に判定済み)
// - mode は paymentConfig.bankTransfer.autoComplete から決定し、
//   レコード作成時に固定する（後で設定が変わっても既存レビューの semantics は不変）
// - mode=immediate ならその場で completePurchase を呼んで通貨を即時付与する
// - mode=approval_required は通貨付与を保留（管理者の confirmReview を待つ）
//
// AI 画像判定のサーバー側検証（aiImageJudgmentEnabled=true 時）:
// judge-image API が purchase_requests.metadata に保存した最新判定をここで検証する。
// クライアントの自己申告は信用しない（API 直叩きで未判定・不合格のまま即時付与を
// 受ける攻撃の防止。未判定 = 不合格として扱う）。
// - 合格: 通常フロー。既存レビューが本フロー由来の needs_check なら pending_review に
//   巻き戻す（ユーザーが正しい画像を出し直したケース。CSV 由来の amount_mismatch は
//   ユーザー操作で解消した証拠にならないため巻き戻さない）
// - 不合格・未判定: unverifiedNote（入金確認のための振込人名等メモ）必須。
//   status=needs_check + reason=image_judgment_failed で登録し、設定が即時付与モード
//   でも mode=approval_required で固定して通貨付与を保留する（confirmReview は
//   approval_required のときのみ付与するため、ここで immediate にすると管理者承認後も
//   永久に付与されない）

import { paymentConfig } from "@/config/app/payment.config";
import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { readBankTransferJudgmentFromMetadata } from "@/features/core/purchaseRequest/constants/bankTransferJudgment";
import { base as purchaseRequestBase } from "@/features/purchaseRequest/services/server/drizzleBase";
import type { PurchaseRequest } from "@/features/purchaseRequest/entities/model";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/purchaseRequest/services/server/payment/inhouse";
import { completePurchase } from "@/features/purchaseRequest/services/server/wrappers/completePurchase";

import type {
  BankTransferReview,
  BankTransferReviewMode,
  BankTransferReviewNeedsCheckContext,
} from "@/features/bankTransferReview/entities/model";
import { validateProofImageUrl } from "@/features/bankTransferReview/utils/validateProofImageUrl";

import { base } from "../drizzleBase";
import { findByPurchaseRequest } from "./findHelpers";
import { lockReviewForSubmit } from "./lockReviewStatus";

export type SubmitReviewParams = {
  purchaseRequestId: string;
  userId: string;
  proofImageUrl: string;
  /**
   * AI 判定が不合格・未判定のまま申告する場合の、入金確認のための振込人名等メモ。
   * 判定不合格時は必須（無いと 400）。合格時は無視する。
   */
  unverifiedNote?: string | null;
};

export type SubmitReviewResult = {
  review: BankTransferReview;
  mode: BankTransferReviewMode;
  /** mode=immediate で completePurchase を実行した場合の wallet_history.id */
  walletHistoryId: string | null;
  /** 申告時に既に purchase_request が completed だった場合 (即時モードの再申告ケース) */
  alreadyCompleted: boolean;
};

export async function submitReview(
  params: SubmitReviewParams,
): Promise<SubmitReviewResult> {
  const { purchaseRequestId, userId, proofImageUrl, unverifiedNote } = params;

  // 1. 関連 purchase_request の取得 + 認可
  //    認可失敗と不在は同一視して 404（存在隠蔽）。
  const purchaseRequest = (await purchaseRequestBase.get(
    purchaseRequestId,
  )) as PurchaseRequest | null;
  if (!purchaseRequest || purchaseRequest.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません。", { status: 404 });
  }

  // 2. 自社銀行振込専用なのでメソッド / プロバイダの整合チェック
  if (
    purchaseRequest.payment_provider !== INHOUSE_PROVIDER_NAME ||
    purchaseRequest.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
  ) {
    throw new DomainError(
      "このリクエストは自社銀行振込ではありません。",
      { status: 400 },
    );
  }

  // 2.5. 振込明細画像 URL の検証
  //      Firebase Storage の正規 URL かつパスが本リクエスト専用の固定パスと完全一致するか
  //      確認する。任意の外部 URL の保存と他ユーザー画像の URL 流用を同時に防ぐ。
  //      認可・メソッド整合チェック後に実施することで、URL 検証による情報漏洩を回避。
  validateProofImageUrl(proofImageUrl, purchaseRequestId);

  // 3. status 検証
  //    - processing: 通常の申告対象（immediate / approval_required どちらも）
  //    - completed: 即時モードで通貨付与済み。レビューが pending_review で残っているなら
  //      再申告で画像差し替えを許可する（誤った画像を上げてしまったケースの救済）
  //    それ以外（pending / failed / expired）は 400。
  if (
    purchaseRequest.status !== "processing" &&
    purchaseRequest.status !== "completed"
  ) {
    throw new DomainError(
      `このリクエストは現在 ${purchaseRequest.status} 状態のため申告できません。`,
      { status: 400 },
    );
  }

  // 4. 既存レビューの確認
  const existing = await findByPurchaseRequest(purchaseRequestId);
  if (
    existing &&
    (existing.status === "confirmed" || existing.status === "rejected")
  ) {
    throw new DomainError(
      "このリクエストは既に判定済みです。",
      { status: 400 },
    );
  }

  // 4.5. AI 画像判定のサーバー側検証
  //      judge-image が purchase_requests.metadata に保存した最新判定で合否を確定する。
  //      未判定（保存値なし）も不合格として扱う（判定をスキップした API 直叩き対策）。
  //      AI 判定が無効な構成では従来どおり検証なし（常に合格扱い）。
  const aiJudgmentEnabled = paymentConfig.bankTransfer.aiImageJudgmentEnabled;
  const judgment = aiJudgmentEnabled
    ? readBankTransferJudgmentFromMetadata(purchaseRequest.metadata)
    : null;
  const judgmentPassed = !aiJudgmentEnabled || judgment?.passed === true;

  // 不合格のまま申告する場合は、入金確認のための振込人名等メモが必須。
  const userNote = (unverifiedNote ?? "").trim();
  if (!judgmentPassed && userNote === "") {
    throw new DomainError(
      "ご入金の確認が取れる振込人名等の情報を入力してください。",
      { status: 400 },
    );
  }

  // 5. mode 決定
  //    既存レビューがあればその mode を維持（途中で変更しない）。
  //    新規作成時は paymentConfig.bankTransfer.autoComplete から決定し、以後不変。
  //    ただし判定不合格の申告は、設定が即時付与でも approval_required で固定する。
  //    通貨付与は管理者の confirmReview 時に行われる（confirmReview は
  //    approval_required のみ付与するため、ここで immediate にすると承認後も
  //    永久に付与されない）。
  const mode: BankTransferReviewMode =
    existing?.mode ??
    (judgmentPassed && paymentConfig.bankTransfer.autoComplete
      ? "immediate"
      : "approval_required");

  // 不合格申告時に needs_check_context へ保存する内容。
  // userNote は管理者が入金照合に使う。judgment は申告時点の判定サマリ（未判定なら null）。
  const needsCheckContext: BankTransferReviewNeedsCheckContext = {
    reason: "image_judgment_failed",
    userNote,
    judgment,
  };

  // 6. レビューを作成または更新 + 監査ログ記録（同一トランザクションで atomic）
  //    再申告時は画像 URL を差し替えて submitted_at を更新する。
  //    base.update / base.create の型は drizzle DefaultInsert ベースで enum 列等を絞り込めない
  //    ため、purchaseRequest 側と同じく any キャストで通す。
  const review = await db.transaction(async (tx) => {
    let next: BankTransferReview;
    if (existing) {
      // 本申告は status を書き換えることがあるため、事前チェック後〜ここまでの間に
      // 管理者操作・CSV 取込が status を変えた場合（TOCTOU）に古い判断で
      // confirmed / rejected を上書きしないよう、行ロックの上で再検証する。
      const locked = await lockReviewForSubmit(tx, existing.id);
      if (!locked) {
        throw new DomainError("レビューが見つかりません。", { status: 404 });
      }
      if (locked.status === "confirmed" || locked.status === "rejected") {
        throw new DomainError("このリクエストは既に判定済みです。", {
          status: 400,
        });
      }

      const updates: Record<string, unknown> = {
        proof_image_url: proofImageUrl,
        submitted_at: new Date(),
      };
      if (!judgmentPassed) {
        // investigating は管理者が能動的に検証中へ移した状態なので維持する。
        // pending_review / needs_check は要確認へ（既存の needs_check は理由を
        // 最新の image_judgment_failed で上書き。旧理由は監査ログで追える）。
        if (locked.status !== "investigating") {
          updates.status = "needs_check" as const;
          updates.needs_check_reason = "image_judgment_failed" as const;
          updates.needs_check_context = needsCheckContext;
        }
      } else if (
        locked.status === "needs_check" &&
        locked.needs_check_reason === "image_judgment_failed"
      ) {
        // 不合格申告で要確認になった後、正しい画像で判定に合格して再申告したケース。
        // ユーザー起因のフラグは解消されたとみなし、通常のレビュー待ちへ戻す。
        // CSV 由来の amount_mismatch はユーザーの再申告では解消しないため対象外。
        // なお mode は作成時の approval_required のまま不変なので即時付与はされない。
        updates.status = "pending_review" as const;
        updates.needs_check_reason = null;
        updates.needs_check_context = null;
      }

      next = (await base.update(
        existing.id,
        updates as unknown as Parameters<typeof base.update>[1],
        tx,
      )) as BankTransferReview;
    } else {
      next = (await base.create(
        {
          purchase_request_id: purchaseRequestId,
          user_id: userId,
          status: judgmentPassed
            ? ("pending_review" as const)
            : ("needs_check" as const),
          mode,
          proof_image_url: proofImageUrl,
          submitted_at: new Date(),
          ...(judgmentPassed
            ? {}
            : {
                needs_check_reason: "image_judgment_failed" as const,
                needs_check_context: needsCheckContext,
              }),
        } as unknown as Parameters<typeof base.create>[0],
        tx,
      )) as BankTransferReview;
    }

    // ユーザー申告アクションを監査ログに記録。
    // actor は createApiRoute 経由の AsyncLocalStorage から自動注入される。
    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      subjectUserId: userId,
      action: "bank_transfer_review.review.submitted",
      before: existing
        ? {
            status: existing.status,
            proof_image_url: existing.proof_image_url,
          }
        : null,
      after: {
        status: next.status,
        mode: next.mode,
        proof_image_url: next.proof_image_url,
        needs_check_reason: next.needs_check_reason,
      },
      metadata: {
        purchaseRequestId,
        isResubmission: Boolean(existing),
        aiJudgmentEnabled,
        judgmentPassed,
        // 不合格申告のみ: ユーザー記載の照合用メモと申告時点の判定サマリを残す
        ...(judgmentPassed ? {} : { userNote, judgment }),
      },
      tx,
    });

    return next;
  });

  // 7. mode=immediate ならその場で completePurchase
  //    purchase_request が既に completed の場合（再申告）は completePurchase 側の
  //    冪等性で早期リターンするため呼んでも安全だが、無駄なので skip する。
  //    判定不合格時は付与しない（mode=immediate の既存レビューへの再申告でも、
  //    不合格のままなら completePurchase の再試行による回復は行わない）。
  let walletHistoryId: string | null = null;
  const alreadyCompleted = purchaseRequest.status === "completed";

  if (mode === "immediate" && judgmentPassed && !alreadyCompleted) {
    const completion = await completePurchase({
      sessionId:
        purchaseRequest.payment_session_id ?? purchaseRequest.id,
      paidAt: new Date(),
      providerName: INHOUSE_PROVIDER_NAME,
    });
    walletHistoryId = completion.walletHistoryId;
  }

  return { review, mode, walletHistoryId, alreadyCompleted };
}
