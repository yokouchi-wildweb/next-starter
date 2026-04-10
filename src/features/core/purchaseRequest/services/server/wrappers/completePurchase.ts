// src/features/core/purchaseRequest/services/server/wrappers/completePurchase.ts
// 購入完了処理（Webhook / ポーリングから呼び出し）

import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { DomainError } from "@/lib/errors/domainError";
import { evaluateMilestones } from "@/features/core/milestone/services/server/wrappers/evaluateMilestones";
import { MILESTONE_TRIGGER_PURCHASE_COMPLETED } from "@/features/core/milestone/constants/triggers";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { getPurchaseCompleteHooks } from "../hooks/purchaseCompleteHookRegistry";
import { findByWebhookIdentifier } from "./purchaseHelpers";
import type { CompletePurchaseParams, CompletePurchaseResult } from "./purchaseService";

// トランザクションクライアント型
type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ============================================================================
// 購入完了
// ============================================================================

/**
 * 購入を完了する
 * Webhookから呼び出され、ウォレット残高を更新
 */
export async function completePurchase(
  params: CompletePurchaseParams
): Promise<CompletePurchaseResult> {
  const { sessionId, transactionId, paymentMethod, paidAt, paidAmount, webhookSignature, providerName } = params;

  // 1. Webhook識別子で購入リクエストを検索
  const purchaseRequest = await findByWebhookIdentifier(sessionId, providerName);
  if (!purchaseRequest) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }

  // 2. 既に完了済みなら何もしない（冪等性）
  if (purchaseRequest.status === "completed") {
    return {
      purchaseRequest,
      walletHistoryId: purchaseRequest.wallet_history_id!,
      milestoneResults: (purchaseRequest.milestone_results as PersistedMilestoneResult[]) ?? [],
    };
  }

  // 3. processing または failed（Webhook順序逆転の救済）のみ許可
  if (purchaseRequest.status !== "processing" && purchaseRequest.status !== "failed") {
    throw new DomainError(
      `無効なステータスです: ${purchaseRequest.status}`,
      { status: 400 }
    );
  }

  // 4. 決済金額の照合（Webhookペイロードの金額とDB上の金額が一致するか検証）
  //    不一致の場合は、修復不能なため status を failed に遷移してから例外を投げる。
  //    こうしないと webhookHandler が DomainError を 200 で飲み込む結果、
  //    リクエストが processing のまま塩漬けになり、ユーザーがコールバック画面で
  //    無限にスピナーを見ることになる。
  if (paidAmount != null && paidAmount !== purchaseRequest.payment_amount) {
    console.error(
      `[completePurchase] 決済金額不一致: paidAmount=${paidAmount}, expected=${purchaseRequest.payment_amount}, requestId=${purchaseRequest.id}`
    );
    await markAsFatalFailure(
      purchaseRequest.id,
      "AMOUNT_MISMATCH",
      "決済金額がリクエストの金額と一致しません。",
    );
    throw new DomainError(
      "決済金額がリクエストの金額と一致しません。",
      { status: 400 }
    );
  }

  // 5. トランザクションでウォレット更新とステータス更新を実行
  const result = await db.transaction(async (tx: TransactionClient) => {
    // 楽観的ロック: processing または failed（Webhook順序逆転の救済）の場合のみ更新
    const [updated] = await tx
      .update(PurchaseRequestTable)
      .set({
        status: "completed",
        completed_at: new Date(),
        transaction_id: transactionId,
        // Webhookから取得した実際の決済方法で上書き（未指定の場合は既存値を維持）
        ...(paymentMethod && { payment_method: paymentMethod }),
        paid_at: paidAt ?? new Date(),
        webhook_signature: webhookSignature,
        // failed からの救済時にエラー情報をクリア
        error_code: null,
        error_message: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(PurchaseRequestTable.id, purchaseRequest.id),
          or(
            eq(PurchaseRequestTable.status, "processing"),
            eq(PurchaseRequestTable.status, "failed")
          )
        )
      )
      .returning();

    if (!updated) {
      throw new DomainError("購入リクエストの更新に失敗しました（既に処理済みの可能性があります）", { status: 409 });
    }

    // ウォレット残高を更新
    const walletResult = await walletService.adjustBalance(
      {
        userId: purchaseRequest.user_id,
        walletType: purchaseRequest.wallet_type as WalletTypeValue,
        changeMethod: "INCREMENT",
        amount: purchaseRequest.amount,
        sourceType: "user_action",
        requestBatchId: purchaseRequest.id,
        reason: "コイン購入",
        reasonCategory: "purchase",
        meta: {
          purchaseRequestId: purchaseRequest.id,
          paymentMethod: purchaseRequest.payment_method,
          paymentAmount: purchaseRequest.payment_amount,
        },
      },
      tx
    );

    // wallet_history_id を記録
    if (!walletResult.history) {
      throw new DomainError("ウォレット履歴の記録に失敗しました。", { status: 500 });
    }
    await tx
      .update(PurchaseRequestTable)
      .set({ wallet_history_id: walletResult.history.id })
      .where(eq(PurchaseRequestTable.id, purchaseRequest.id));

    // クーポン使用処理（クーポンコードが記録されている場合）
    if (purchaseRequest.coupon_code) {
      try {
        await couponService.redeemWithEffect(
          purchaseRequest.coupon_code,
          purchaseRequest.user_id,
          { purchaseRequestId: purchaseRequest.id },
          tx,
        );
      } catch (error) {
        // クーポンredeem失敗は購入完了をブロックしない
        // ただし失敗をDBに記録して管理者が後から検知・対応できるようにする
        console.error(
          `[completePurchase] クーポンredeem失敗: code=${purchaseRequest.coupon_code}, requestId=${purchaseRequest.id}`,
          error,
        );
        await tx
          .update(PurchaseRequestTable)
          .set({ coupon_redeem_failed: true })
          .where(eq(PurchaseRequestTable.id, purchaseRequest.id));
      }
    }

    // ポストフック実行（登録済みフックがなければ何もしない）
    const purchaseCompleteHooks = getPurchaseCompleteHooks();
    for (let i = 0; i < purchaseCompleteHooks.length; i++) {
      const hook = purchaseCompleteHooks[i];
      const savepointName = `purchase_hook_${i}`;
      try {
        await tx.execute(sql.raw(`SAVEPOINT ${savepointName}`));
        await hook.handler({
          purchaseRequest: { ...updated, wallet_history_id: walletResult.history.id } as PurchaseRequest,
          walletResult: { history: walletResult.history },
          tx,
        });
        await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepointName}`));
      } catch (error) {
        try {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
        } catch (rollbackError) {
          console.error(`[completePurchase] SAVEPOINT ロールバック失敗 (hook: ${hook.key}):`, rollbackError);
        }
        console.error(`[completePurchase] ポストフック "${hook.key}" の実行中にエラー:`, error);
      }
    }

    // マイルストーン評価（登録済みマイルストーンがなければ何もしない）
    const milestoneResult = await evaluateMilestones(
      MILESTONE_TRIGGER_PURCHASE_COMPLETED,
      {
        userId: purchaseRequest.user_id,
        payload: {
          purchaseRequest: { ...updated, wallet_history_id: walletResult.history.id },
          walletHistoryId: walletResult.history.id,
        },
      },
      tx,
    );

    // マイルストーン結果を永続化（達成されたもののみ）
    const persistedResults: PersistedMilestoneResult[] = milestoneResult.results
      .filter((r) => r.achieved)
      .map((r) => ({
        milestoneKey: r.key,
        achieved: true,
        ...(r.metadata && { metadata: r.metadata as Record<string, unknown> }),
      }));

    if (persistedResults.length > 0) {
      await tx
        .update(PurchaseRequestTable)
        .set({ milestone_results: persistedResults })
        .where(eq(PurchaseRequestTable.id, purchaseRequest.id));
    }

    return {
      purchaseRequest: {
        ...updated,
        wallet_history_id: walletResult.history.id,
        milestone_results: persistedResults.length > 0 ? persistedResults : null,
      } as PurchaseRequest,
      walletHistoryId: walletResult.history.id,
      milestoneResults: persistedResults,
    };
  });

  return result;
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * 修復不能な DomainError を投げる前に呼び出すヘルパー。
 * 購入リクエストの status を `failed` に遷移させ、エラー情報を記録する。
 *
 * これがないと、completePurchase が投げた DomainError が webhookHandler で
 * リトライ防止のために 200 として飲み込まれた結果、リクエストが processing の
 * まま塩漬けになり、クライアント側のポーリングが完了を検知できないまま
 * 60秒のタイムアウトを待つことになる（無限スピナーの原因）。
 *
 * 楽観ロック (`WHERE status = 'processing'`) 付きで、すでに completed や failed
 * になっているレコードは絶対に上書きしないため、既存の冪等性は破壊しない。
 *
 * 将来 completePurchase に新しい「修復不能エラー」分岐を追加する場合は、
 * 必ず throw 前にこのヘルパーを呼び出すこと。
 */
async function markAsFatalFailure(
  requestId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  try {
    await db
      .update(PurchaseRequestTable)
      .set({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(PurchaseRequestTable.id, requestId),
          eq(PurchaseRequestTable.status, "processing"),
        ),
      );
  } catch (error) {
    // ヘルパー内でのエラーは握りつぶす（呼び出し元の DomainError を優先して投げるため）。
    // ログは残して運用側で検知できるようにする。
    console.error(
      `[markAsFatalFailure] status 遷移に失敗: requestId=${requestId}, errorCode=${errorCode}`,
      error,
    );
  }
}
