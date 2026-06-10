// src/features/core/purchaseRequest/services/server/wrappers/purchaseHelpers.ts
// 購入リクエストのヘルパー関数（識別子解決、冪等キー検索、期限切れ処理）

import { and, eq, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { releaseQuota } from "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import type { PaymentProviderName } from "../payment";
import { getPurchaseCompletionStrategy, getRegisteredPurchaseTypes } from "../completion";
import type { InitiatePurchaseResult } from "./purchaseService";

// ============================================================================
// 冪等キー検索
// ============================================================================

/**
 * 冪等キーで購入リクエストを検索（**必ず user_id でスコープする**）。
 *
 * セキュリティ: 冪等キーが intent 由来（決定論的）になると予測可能になり得るため、
 * user_id を AND しないと他人の purchase_request を冪等ヒットさせて掴む認可バイパスの芽になる。
 * idempotency_key は unique だが、検索は必ず本人スコープに限定する。
 */
export async function findByIdempotencyKey(
  idempotencyKey: string,
  userId: string,
): Promise<PurchaseRequest | null> {
  const results = await db
    .select()
    .from(PurchaseRequestTable)
    .where(
      and(
        eq(PurchaseRequestTable.idempotency_key, idempotencyKey),
        eq(PurchaseRequestTable.user_id, userId),
      ),
    )
    .limit(1);

  return (results[0] as PurchaseRequest) ?? null;
}

// ============================================================================
// Webhook識別子リゾルバー（プロバイダ別）
// ============================================================================

/**
 * プロバイダ固有のWebhook識別子から購入リクエストを検索するリゾルバー
 * 新しいプロバイダを追加する場合は、ここにリゾルバーを追加する
 */
type WebhookIdentifierResolver = (
  identifier: string
) => Promise<PurchaseRequest | null>;

/**
 * Fincode用リゾルバー
 * Fincodeは order_id（purchase_request.id のハイフン除去・30文字切り詰め）を送信する
 * 1. provider_order_id カラムでインデックス検索（新規レコード）
 * 2. フォールバック: 全レコードスキャンで照合（provider_order_id 未設定の既存レコード用）
 */
async function resolveFincodeIdentifier(
  identifier: string
): Promise<PurchaseRequest | null> {
  // order_id 形式（30文字のハイフン除去されたID）の場合のみ処理
  if (identifier.length !== 30 || identifier.includes("-")) {
    return null;
  }

  // 1. provider_order_id カラムでインデックス検索
  const byOrderId = await db
    .select()
    .from(PurchaseRequestTable)
    .where(eq(PurchaseRequestTable.provider_order_id, identifier))
    .limit(1);

  if (byOrderId[0]) {
    return byOrderId[0] as PurchaseRequest;
  }

  // 2. フォールバック: provider_order_id が未設定の既存レコード用
  //    将来的に全レコードに provider_order_id が設定されたら削除可能
  //    NOTE: SQL の NULL 比較は = NULL では動かないため必ず IS NULL (drizzle: isNull) を使う
  const candidates = await db
    .select()
    .from(PurchaseRequestTable)
    .where(
      and(
        isNull(PurchaseRequestTable.provider_order_id),
        or(
          eq(PurchaseRequestTable.status, "processing"),
          eq(PurchaseRequestTable.status, "completed")
        )
      )
    );

  const matched = candidates.find((r) => {
    const orderIdFromId = r.id.replace(/-/g, "").slice(0, 30);
    return orderIdFromId === identifier;
  });

  return (matched as PurchaseRequest) ?? null;
}

/**
 * プロバイダ別のWebhook識別子リゾルバーマップ
 * 汎用検索（payment_session_id）で見つからない場合のフォールバック
 */
const webhookIdentifierResolvers: Partial<
  Record<PaymentProviderName, WebhookIdentifierResolver>
> = {
  fincode: resolveFincodeIdentifier,
  // 他のプロバイダを追加する場合はここに追加
  // stripe: resolveStripeIdentifier,
  // komoju: resolveKomojuIdentifier,
};

/**
 * Webhook識別子から購入リクエストを検索
 * 1. まず汎用的な payment_session_id で検索
 * 2. identifier が UUID 形式なら purchaseRequest.id で検索（Square 等、payment.note に purchaseRequestId を格納するプロバイダ向け）
 * 3. 見つからない場合、プロバイダ固有のリゾルバーを使用
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findByWebhookIdentifier(
  identifier: string,
  providerName?: PaymentProviderName
): Promise<PurchaseRequest | null> {
  // 1. 汎用: payment_session_id で検索
  const bySessionId = await db
    .select()
    .from(PurchaseRequestTable)
    .where(eq(PurchaseRequestTable.payment_session_id, identifier))
    .limit(1);

  if (bySessionId[0]) {
    return bySessionId[0] as PurchaseRequest;
  }

  // 2. UUID 形式なら purchaseRequest.id で検索
  if (UUID_RE.test(identifier)) {
    const byId = await db
      .select()
      .from(PurchaseRequestTable)
      .where(eq(PurchaseRequestTable.id, identifier))
      .limit(1);

    if (byId[0]) {
      return byId[0] as PurchaseRequest;
    }
  }

  // 3. プロバイダ固有のフォールバック
  if (providerName) {
    const resolver = webhookIdentifierResolvers[providerName];
    if (resolver) {
      return resolver(identifier);
    }
  }

  return null;
}

// ============================================================================
// 既存リクエスト → レスポンス構築（resolveInitiation の outcome から呼ばれる）
// ============================================================================
//
// handleExistingRequest（旧: status を内部 switch する一枚岩）は廃止。状態判定は
// resolveInitiation（純粋リゾルバ）に集約し、ここは「completed の完了画面誘導」と
// 「redirect 型の processing 再開（保存済み redirect_url 再利用）」のレスポンス構築だけを担う。

/**
 * wallet_type から slug を解決する（wallet_topup 以外は null）。
 * 完了/コールバック URL のフォールバック生成に使う。
 */
function slugOf(existing: PurchaseRequest): string | null {
  return existing.wallet_type
    ? getSlugByWalletType(existing.wallet_type as WalletType)
    : null;
}

/**
 * 完了済み purchase_request を完了画面へ誘導するレスポンスを構築する。
 * resolveInitiation の `completed` outcome から呼ばれる。
 *
 * wallet_topup 以外（wallet_type=null）は slug ベースの URL を持たないため、保存済み
 * redirect_url があればそれを、なければ空文字を返す（下流が独自の完了ページを redirect_url に入れる運用）。
 */
export function buildCompletedResult(
  existing: PurchaseRequest,
): InitiatePurchaseResult {
  const slug = slugOf(existing);
  const url = slug
    ? `/wallet/${slug}/purchase/complete?request_id=${existing.id}`
    : (existing.redirect_url ?? "");
  return {
    purchaseRequest: existing,
    instruction: { type: "redirect", url },
    successUrl: url,
    cancelUrl: url,
    alreadyCompleted: true,
  };
}

/**
 * redirect 型 provider の processing 既存を、保存済み redirect_url（無ければコールバック画面）
 * へ戻すレスポンスを構築する。
 *
 * 呼び出し元:
 * - resolveInitiation の `resume` outcome のうち launchType==="redirect" のケース
 * - inhouse の validateInitiation guard（進行中の振込案内ページへ復帰）
 *
 * client_sdk 型は redirect_url を持たず resume 時は createSession 再実行（別経路）になるため、
 * この関数には到達しない。
 */
export function buildRedirectResumeResult(
  existing: PurchaseRequest,
): InitiatePurchaseResult {
  const slug = slugOf(existing);
  const fallback = slug ? `/wallet/${slug}/purchase/callback?request_id=${existing.id}` : "";
  const url = existing.redirect_url ?? fallback;
  return {
    purchaseRequest: existing,
    instruction: { type: "redirect", url },
    successUrl: url,
    cancelUrl: url,
    alreadyProcessing: true,
  };
}

// ============================================================================
// 期限切れ処理（バッチ用）
// ============================================================================

/**
 * 期限切れの購入リクエストを expired に更新
 * バッチジョブから定期的に呼び出す
 *
 * パフォーマンス設計:
 *   - onExpire を定義していない purchase_type → 従来通り bulk UPDATE 一発（高速）
 *   - onExpire を定義している purchase_type のみ per-row 処理（副次テーブル掃除）
 *
 * これにより wallet_topup 等の onExpire 不要な既存フローは性能無影響のまま、
 * 下流が必要な purchase_type だけ onExpire を有効化できる。
 */
export async function expirePendingRequests(): Promise<number> {
  const now = new Date();

  // 登録済み戦略のうち onExpire を持つものを収集
  const typesWithOnExpire = getRegisteredPurchaseTypes().filter(
    (type) => getPurchaseCompletionStrategy(type)?.onExpire != null,
  );

  let totalExpired = 0;

  // 1. onExpire を持たない purchase_type を bulk UPDATE で一括 expire（高速パス）
  const bulkCondition = typesWithOnExpire.length > 0
    ? and(
        eq(PurchaseRequestTable.status, "pending"),
        lt(PurchaseRequestTable.expires_at, now),
        notInArray(PurchaseRequestTable.purchase_type, typesWithOnExpire),
      )
    : and(
        eq(PurchaseRequestTable.status, "pending"),
        lt(PurchaseRequestTable.expires_at, now),
      );

  const bulkRows = await db
    .update(PurchaseRequestTable)
    .set({ status: "expired", updatedAt: now })
    .where(bulkCondition)
    .returning();

  totalExpired += bulkRows.length;

  // 一括 expire した分のクォータ台帳を released に遷移 (PURCHASE_QUOTA_RULES が空なら no-op)。
  // bulk 経路は onExpire を持たないため別 tx での release で十分 (購入レコードは確定済み)。
  if (bulkRows.length > 0) {
    await releaseQuota(bulkRows.map((row) => row.id));
  }

  // 2. onExpire を持つ purchase_type は per-row で expire + フック実行（atomic）
  if (typesWithOnExpire.length > 0) {
    const targetRows = await db
      .select()
      .from(PurchaseRequestTable)
      .where(
        and(
          eq(PurchaseRequestTable.status, "pending"),
          lt(PurchaseRequestTable.expires_at, now),
          inArray(PurchaseRequestTable.purchase_type, typesWithOnExpire),
        ),
      );

    for (const row of targetRows) {
      const strategy = getPurchaseCompletionStrategy(row.purchase_type);
      if (!strategy?.onExpire) continue;

      try {
        await db.transaction(async (tx) => {
          // 楽観的ロック: status='pending' の場合のみ更新
          const [updated] = await tx
            .update(PurchaseRequestTable)
            .set({ status: "expired", updatedAt: now })
            .where(
              and(
                eq(PurchaseRequestTable.id, row.id),
                eq(PurchaseRequestTable.status, "pending"),
              ),
            )
            .returning();
          if (!updated) return; // 他プロセスで既に遷移済み

          await strategy.onExpire!({
            purchaseRequest: updated as PurchaseRequest,
            tx,
          });
          // クォータ台帳を released に遷移 (PURCHASE_QUOTA_RULES が空なら no-op)
          await releaseQuota(updated.id, tx);
          totalExpired += 1;
        });
      } catch (error) {
        // 1件のフック失敗で全体を止めないためログのみ
        console.error(
          `[expirePendingRequests] onExpire 失敗: requestId=${row.id}, purchase_type=${row.purchase_type}`,
          error,
        );
      }
    }
  }

  return totalExpired;
}
