// src/features/core/purchaseRequest/services/server/wrappers/purchaseHelpers.ts
// 購入リクエストのヘルパー関数（識別子解決、冪等キー検索、期限切れ処理）

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { DomainError } from "@/lib/errors/domainError";
import type { PaymentProviderName } from "../payment";
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
 */
async function resolveFincodeIdentifier(
  identifier: string
): Promise<PurchaseRequest | null> {
  // order_id 形式（30文字のハイフン除去されたID）の場合のみ処理
  if (identifier.length !== 30 || identifier.includes("-")) {
    return null;
  }

  // processing または completed ステータスのリクエストから検索（冪等性のため）
  const candidates = await db
    .select()
    .from(PurchaseRequestTable)
    .where(
      eq(PurchaseRequestTable.status, "processing")
    );

  // completedも検索（Webhookの再送対応）
  const completedCandidates = await db
    .select()
    .from(PurchaseRequestTable)
    .where(
      eq(PurchaseRequestTable.status, "completed")
    );

  const allCandidates = [...candidates, ...completedCandidates];

  const matched = allCandidates.find((r) => {
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
  const slug = getSlugByWalletType(existing.wallet_type as WalletType);

  switch (existing.status) {
    case "completed":
      return {
        purchaseRequest: existing,
        redirectUrl: `/wallet/${slug}/purchase/complete?request_id=${existing.id}`,
        alreadyCompleted: true,
      };

    case "processing":
      return {
        purchaseRequest: existing,
        redirectUrl: existing.redirect_url ?? `/wallet/${slug}/purchase/callback?request_id=${existing.id}`,
        alreadyProcessing: true,
      };

    case "pending":
      // pending の場合は続行（リダイレクトURLがあればそれを使う）
      return {
        purchaseRequest: existing,
        redirectUrl: existing.redirect_url ?? `/wallet/${slug}/purchase/failed?request_id=${existing.id}&reason=invalid_state`,
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
 */
export async function expirePendingRequests(): Promise<number> {
  const now = new Date();

  const result = await db
    .update(PurchaseRequestTable)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(PurchaseRequestTable.status, "pending"),
        lt(PurchaseRequestTable.expires_at, now)
      )
    )
    .returning();

  return result.length;
}
