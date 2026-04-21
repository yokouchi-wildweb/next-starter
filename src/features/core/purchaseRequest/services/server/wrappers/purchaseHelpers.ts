// src/features/core/purchaseRequest/services/server/wrappers/purchaseHelpers.ts
// 購入リクエストのヘルパー関数（識別子解決、冪等キー検索、期限切れ処理）

import { and, eq, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { DomainError } from "@/lib/errors/domainError";
import type { PaymentProviderName } from "../payment";
import { getPurchaseCompletionStrategy, getRegisteredPurchaseTypes } from "../completion";
import type { InitiatePurchaseResult } from "./purchaseService";

// ============================================================================
// 冪等キー検索
// ============================================================================

/**
 * 冪等キーで購入リクエストを検索
 */
export async function findByIdempotencyKey(
  idempotencyKey: string
): Promise<PurchaseRequest | null> {
  const results = await db
    .select()
    .from(PurchaseRequestTable)
    .where(eq(PurchaseRequestTable.idempotency_key, idempotencyKey))
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
// 既存リクエストの処理
// ============================================================================

/**
 * 既存リクエストの処理
 * ステータスに応じて適切なレスポンスを返す
 */
export function handleExistingRequest(
  existing: PurchaseRequest
): InitiatePurchaseResult {
  // wallet_topup 以外（wallet_type が null）では slug ベースの URL フォールバックを持たない。
  // その場合 redirect_url がレコードに保存されていればそれを使い、なければ空文字列を返す。
  // 下流は direct_sale 等で自前のコールバック/完了ページを redirect_url に入れる運用にすること。
  const slug = existing.wallet_type ? getSlugByWalletType(existing.wallet_type as WalletType) : null;

  switch (existing.status) {
    case "completed":
      return {
        purchaseRequest: existing,
        redirectUrl: slug ? `/wallet/${slug}/purchase/complete?request_id=${existing.id}` : (existing.redirect_url ?? ""),
        alreadyCompleted: true,
      };

    case "processing":
      return {
        purchaseRequest: existing,
        redirectUrl: existing.redirect_url ?? (slug ? `/wallet/${slug}/purchase/callback?request_id=${existing.id}` : ""),
        alreadyProcessing: true,
      };

    case "pending":
      // pending の場合は続行（リダイレクトURLがあればそれを使う）
      return {
        purchaseRequest: existing,
        redirectUrl: existing.redirect_url ?? (slug ? `/wallet/${slug}/purchase/failed?request_id=${existing.id}&reason=invalid_state` : ""),
        alreadyProcessing: true,
      };

    case "failed":
    case "expired":
      // 失敗/期限切れの場合はエラー
      throw new DomainError(
        "この購入リクエストは既に失敗または期限切れです。新しい購入を開始してください。",
        { status: 400 }
      );

    default:
      throw new DomainError("不明なステータスです", { status: 500 });
  }
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
