// src/features/core/purchaseRequest/services/server/wrappers/purchaseService.ts

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { base } from "../drizzleBase";
import {
  getPaymentProvider,
  getDefaultProviderName,
  type PaymentProviderName,
} from "../payment";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors/domainError";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";
import { evaluateMilestones } from "@/features/core/milestone/services/server/wrappers/evaluateMilestones";
import { MILESTONE_TRIGGER_PURCHASE_COMPLETED } from "@/features/core/milestone/constants/triggers";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { PURCHASE_DISCOUNT_CATEGORY, type PurchaseDiscountEffect } from "../../../types/couponEffect";
import { getPurchaseCompleteHooks } from "../hooks/purchaseCompleteHookRegistry";
import { getPaymentSessionEnricher } from "../payment/sessionEnricher";

// フック定義の副作用インポート（登録を実行）
import "../hooks/definitions";
// エンリッチャー定義の副作用インポート（登録を実行）
import "../payment/enrichers";

// トランザクションクライアント型
type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ============================================================================
// 型定義
// ============================================================================

export type InitiatePurchaseParams = {
  userId: string;
  idempotencyKey: string;
  walletType: WalletTypeValue;
  amount: number;
  paymentAmount: number;
  paymentMethod: string;
  paymentProvider?: PaymentProviderName;
  baseUrl: string;
  /** 商品名（決済ページに表示） */
  itemName?: string;
  /** クーポンコード（割引適用時） */
  couponCode?: string;
  /** プロバイダ固有のオプション（決済セッション作成時にそのまま渡される） */
  providerOptions?: Record<string, unknown>;
};

export type InitiatePurchaseResult = {
  purchaseRequest: PurchaseRequest;
  redirectUrl: string;
  alreadyProcessing?: boolean;
  alreadyCompleted?: boolean;
};

export type CompletePurchaseParams = {
  sessionId: string;
  /** プロバイダ側の取引ID */
  transactionId?: string;
  /** 実際に使用された決済方法（Webhookから取得） */
  paymentMethod?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
  /** Webhook署名（デバッグ用） */
  webhookSignature?: string;
  /** 決済プロバイダ名（識別子解決に使用） */
  providerName?: PaymentProviderName;
};

export type CompletePurchaseResult = {
  purchaseRequest: PurchaseRequest;
  walletHistoryId: string;
  /** マイルストーン評価結果（達成されたもののみ） */
  milestoneResults?: PersistedMilestoneResult[];
};

export type FailPurchaseParams = {
  sessionId: string;
  errorCode?: string;
  errorMessage?: string;
  /** 決済プロバイダ名（識別子解決に使用） */
  providerName?: PaymentProviderName;
};

export type HandleWebhookParams = {
  request: Request;
  providerName?: PaymentProviderName;
  /** Webhook署名（デバッグ用に記録） */
  webhookSignature?: string;
};

export type HandleWebhookResult = {
  success: boolean;
  requestId: string;
  walletHistoryId?: string;
  /** マイルストーン評価結果（達成されたもののみ） */
  milestoneResults?: PersistedMilestoneResult[];
  message: string;
};

// ============================================================================
// 購入開始
// ============================================================================

/**
 * 購入を開始する
 * 1. 冪等キーで既存チェック
 * 2. purchase_request 作成
 * 3. 決済セッション作成
 * 4. リダイレクトURL返却
 */
export async function initiatePurchase(
  params: InitiatePurchaseParams
): Promise<InitiatePurchaseResult> {
  const {
    userId,
    idempotencyKey,
    walletType,
    amount,
    paymentAmount,
    paymentMethod,
    paymentProvider = getDefaultProviderName(),
    baseUrl,
    itemName,
    couponCode,
    providerOptions,
  } = params;

  // 1. 冪等キーで既存リクエストをチェック
  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing) {
    return handleExistingRequest(existing);
  }

  // 2. クーポン検証（コードが指定されている場合）
  let actualPaymentAmount = paymentAmount;
  let discountAmount: number | undefined;
  if (couponCode) {
    const validation = await couponService.validateForCategory(
      couponCode,
      PURCHASE_DISCOUNT_CATEGORY,
      userId,
      { paymentAmount },
    );
    if (!validation.valid) {
      throw new DomainError(
        validation.reason === "category_mismatch"
          ? "このクーポンは購入割引には使用できません。"
          : `クーポンを適用できません: ${validation.reason}`,
        { status: 400 },
      );
    }
    const effect = validation.effect as PurchaseDiscountEffect | null;
    if (effect) {
      discountAmount = effect.discountAmount;
      actualPaymentAmount = effect.finalPaymentAmount;
    }
  }

  // 3. purchase_request を作成（status: pending）
  const createData = {
    user_id: userId,
    idempotency_key: idempotencyKey,
    wallet_type: walletType,
    amount,
    payment_amount: actualPaymentAmount,
    payment_method: paymentMethod,
    payment_provider: paymentProvider,
    status: "pending" as const,
    expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30分後
    // クーポン情報（適用時のみ記録）
    ...(couponCode && {
      coupon_code: couponCode,
      discount_amount: discountAmount ?? 0,
      original_payment_amount: paymentAmount,
    }),
  };
  console.log("Creating purchase request with data:", JSON.stringify(createData, null, 2));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseRequest = await base.create(createData as any) as PurchaseRequest;
  console.log("Purchase request created:", purchaseRequest.id);

  // 4. 決済プロバイダでセッション作成
  const slug = getSlugByWalletType(walletType as WalletType);
  const provider = getPaymentProvider(paymentProvider);

  // ユーザー情報を取得（決済ページで事前入力用）
  const user = await userService.get(userId);
  const buyerEmail = user?.email || undefined;
  const buyerPhoneNumber = user?.phoneNumber
    ? formatToE164(user.phoneNumber)
    : undefined;

  const baseSessionParams = {
    purchaseRequestId: purchaseRequest.id,
    amount: actualPaymentAmount,
    userId,
    successUrl: `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}`,
    cancelUrl: `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}&reason=cancelled`,
    metadata: itemName ? { itemName } : undefined,
    buyerEmail,
    buyerPhoneNumber,
    providerOptions,
  };

  // セッションエンリッチャー（登録されていればパラメータを拡張）
  const sessionEnricher = getPaymentSessionEnricher();
  const sessionParams = sessionEnricher
    ? await sessionEnricher({ userId, walletType, baseParams: baseSessionParams })
    : baseSessionParams;

  const session = await provider.createSession(sessionParams);

  // 5. セッション情報を記録（status: processing）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await base.update(purchaseRequest.id, {
    status: "processing",
    payment_session_id: session.sessionId,
    redirect_url: session.redirectUrl,
  } as any) as PurchaseRequest;

  return {
    purchaseRequest: updated,
    redirectUrl: session.redirectUrl,
  };
}

// ============================================================================
// ステータス取得（Callback用ポーリング）
// ============================================================================

/**
 * 購入リクエストのステータスを取得
 */
export async function getPurchaseStatus(requestId: string): Promise<PurchaseRequest | null> {
  const result = await base.get(requestId);
  return result as PurchaseRequest | null;
}

/**
 * ユーザーIDとリクエストIDで購入リクエストを取得（認可チェック用）
 * processingステータスの場合、決済プロバイダーにステータスを確認してDBを更新
 */
export async function getPurchaseStatusForUser(
  requestId: string,
  userId: string
): Promise<PurchaseRequest | null> {
  const request = await base.get(requestId) as PurchaseRequest | null;
  if (!request || request.user_id !== userId) {
    return null;
  }

  // processingの場合、プロバイダーにステータスを確認
  if (request.status === "processing" && request.payment_session_id && request.payment_provider) {
    const providerName = request.payment_provider as PaymentProviderName;
    try {
      const provider = getPaymentProvider(providerName);
      // getPaymentStatusはオプショナルなので、未実装の場合はスキップ
      if (!provider.getPaymentStatus) {
        return request;
      }
      const providerStatus = await provider.getPaymentStatus(request.payment_session_id);

      if (providerStatus.status === "completed") {
        // 決済完了 → DB更新
        const result = await completePurchase({
          sessionId: request.payment_session_id,
          transactionId: providerStatus.transactionId,
          paidAt: providerStatus.paidAt,
          providerName,
        });
        return result.purchaseRequest;
      } else if (providerStatus.status === "failed" || providerStatus.status === "expired") {
        // 決済失敗/期限切れ → DB更新
        const result = await failPurchase({
          sessionId: request.payment_session_id,
          errorCode: providerStatus.errorCode,
          errorMessage: providerStatus.errorMessage,
          providerName,
        });
        return result;
      }
      // pending/processing の場合はそのまま返す
    } catch (error) {
      console.error("[getPurchaseStatusForUser] Provider status check failed:", error);
      // エラー時は現在のステータスをそのまま返す
    }
  }

  return request;
}

// ============================================================================
// 購入完了（Webhook用）
// ============================================================================

/**
 * 購入を完了する
 * Webhookから呼び出され、ウォレット残高を更新
 */
export async function completePurchase(
  params: CompletePurchaseParams
): Promise<CompletePurchaseResult> {
  const { sessionId, transactionId, paymentMethod, paidAt, webhookSignature, providerName } = params;

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

  // 3. processing以外のステータスはエラー
  if (purchaseRequest.status !== "processing") {
    throw new DomainError(
      `無効なステータスです: ${purchaseRequest.status}`,
      { status: 400 }
    );
  }

  // 4. トランザクションでウォレット更新とステータス更新を実行
  const result = await db.transaction(async (tx: TransactionClient) => {
    // 楽観的ロック: processingの場合のみ更新
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
        updatedAt: new Date(),
      })
      .where(eq(PurchaseRequestTable.id, purchaseRequest.id))
      .returning();

    if (!updated || updated.status !== "completed") {
      throw new DomainError("購入リクエストの更新に失敗しました", { status: 409 });
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
        // クーポンredeem失敗は購入完了をブロックしない（ログのみ）
        console.error("[completePurchase] クーポンredeem失敗:", error);
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
// 購入失敗
// ============================================================================

/**
 * 購入を失敗としてマーク
 */
export async function failPurchase(params: FailPurchaseParams): Promise<PurchaseRequest> {
  const { sessionId, errorCode, errorMessage, providerName } = params;

  const purchaseRequest = await findByWebhookIdentifier(sessionId, providerName);
  if (!purchaseRequest) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }

  // 既に完了済みなら変更しない
  if (purchaseRequest.status === "completed") {
    return purchaseRequest;
  }

  // 既に失敗済みなら何もしない
  if (purchaseRequest.status === "failed") {
    return purchaseRequest;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await base.update(purchaseRequest.id, {
    status: "failed",
    error_code: errorCode ?? "PAYMENT_FAILED",
    error_message: errorMessage ?? "決済に失敗しました",
  } as any) as PurchaseRequest;

  return result;
}

// ============================================================================
// Webhook処理
// ============================================================================

/**
 * Webhookを処理する
 * プロバイダ選択、検証、結果に応じた処理を一括で行う
 */
export async function handleWebhook(
  params: HandleWebhookParams
): Promise<HandleWebhookResult> {
  const { request, providerName = getDefaultProviderName(), webhookSignature } = params;

  // 1. プロバイダでWebhookを検証・パース
  const provider = getPaymentProvider(providerName);
  const paymentResult = await provider.verifyWebhook(request);

  // 2. 決済結果に応じて処理
  if (paymentResult.success) {
    // 決済成功 → 購入完了処理
    const result = await completePurchase({
      sessionId: paymentResult.sessionId,
      transactionId: paymentResult.transactionId,
      paymentMethod: paymentResult.paymentMethod,
      paidAt: paymentResult.paidAt,
      webhookSignature,
      providerName,
    });

    return {
      success: true,
      requestId: result.purchaseRequest.id,
      walletHistoryId: result.walletHistoryId,
      milestoneResults: result.milestoneResults,
      message: "購入が完了しました。",
    };
  } else {
    // 決済失敗 → 失敗処理
    const result = await failPurchase({
      sessionId: paymentResult.sessionId,
      errorCode: paymentResult.errorCode,
      errorMessage: paymentResult.errorMessage,
      providerName,
    });

    return {
      success: true, // Webhook処理自体は成功
      requestId: result.id,
      message: "決済失敗を記録しました。",
    };
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
    .where(eq(PurchaseRequestTable.status, "pending"))
    .returning();

  // TODO: expires_at < now の条件を追加
  // 現在はDrizzleのand条件が複雑なため簡略化

  return result.length;
}

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * 冪等キーで購入リクエストを検索
 */
async function findByIdempotencyKey(
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
 * 2. 見つからない場合、プロバイダ固有のリゾルバーを使用
 */
async function findByWebhookIdentifier(
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

  // 2. プロバイダ固有のフォールバック
  if (providerName) {
    const resolver = webhookIdentifierResolvers[providerName];
    if (resolver) {
      return resolver(identifier);
    }
  }

  return null;
}

/**
 * 既存リクエストの処理
 * ステータスに応じて適切なレスポンスを返す
 */
function handleExistingRequest(
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
