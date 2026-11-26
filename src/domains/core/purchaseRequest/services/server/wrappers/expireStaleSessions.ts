// src/domains/core/purchaseRequest/services/server/wrappers/expireStaleSessions.ts
//
// 放置された client_sdk 型 processing リクエストの片付け(照らしてから閉じる)。
//
// 背景:
// 冪等キーを intent 由来にした結果、ユーザーが支払い方法や金額を切り替えると別の冪等キー＝
// 別 purchase_request が作られ、切り替え前の client_sdk(PayPal/Paidy)の processing リクエストが
// 放置される。確定 API(confirm)が失敗した行も processing のまま残る(confirmPayPalPayment は
// capture を確かめられない時に error_code を書いて processing のまま返す)。
//
// なぜ閉じる前に照らすか:
// - capture は我々の confirm が呼ぶが、confirm の呼び出しが時間切れ・通信の失敗で終わった後に
//   PayPal 側で capture が済んでいることがある(captureOrder は応答を受け取れないと null)。
//   照らさずに expired にすると、払われた注文にコインが付かない。
// - よって 1 行ずつ reconcileWithProvider で照らし、払われていれば完了、失敗なら failed、
//   決まらない(承認だけ・未承認)物だけを expired にする。照会が throw した行は触らない(次の回に照らす)。
// - expired の後に払いが確かめられても completePurchase が完了にする(webhook の CAPTURE.COMPLETED 等)。
//
// なぜ承認だけの物を expired にしてよいか:
// - PayPal の CAPTURE intent Order は API で void/cancel できない(未 capture なら自動失効する)。
//   capture は我々の confirm からしか呼ばれず、expired の行は confirm が弾くので、それ以上 capture されない。
// - Paidy は createSession 時点でサーバー側 payment を作らない(SDK がクライアント側で生成)。
//
// 読み手は 2 つ: initiatePurchase の新規作成の直前(同じ利用者の行、expireStaleClientSdkSessions)と、
// cron expire-pending-purchases(期限 expires_at を過ぎた全利用者の行、settleExpiredClientSdkSessions)。

import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import { PurchaseRequestTable } from "@/domains/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/domains/core/purchaseRequest/entities/model";
import { releaseQuota } from "@/domains/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper";
import { getPurchaseCompletionStrategy } from "../completion";
import { getPaymentProvider, type PaymentProviderName } from "../payment";
import { reconcileWithProvider } from "./reconcileWithProvider";
import { transitionStatus } from "./transitionStatus";

/** 片付けた 1 行の結果(照らして完了・失敗、決まらず expired、照会できず残した) */
export type StaleSessionOutcome = "completed" | "failed" | "expired" | "kept";

/** provider 名が client_sdk 型か(未知・未実装の provider は false) */
function isClientSdkProvider(providerName: string | null | undefined): boolean {
  if (!providerName) return false;
  try {
    return getPaymentProvider(providerName as PaymentProviderName).launchType === "client_sdk";
  } catch {
    return false;
  }
}

/**
 * 放置された client_sdk の processing 1 行を片付ける: プロバイダと照らし、決まらない物だけ expired にする。
 * 照会・完了の処理が throw した時は行を触らず "kept"(ログのみ。次の回に照らす)。
 */
export async function settleStaleClientSdkSession(row: PurchaseRequest): Promise<StaleSessionOutcome> {
  try {
    const outcome = await reconcileWithProvider(row);
    if (outcome.kind !== "open") return outcome.kind;
  } catch (error) {
    console.error(`[settleStaleClientSdkSession] 照合に失敗(行は残す): id=${row.id}`, error);
    return "kept";
  }

  try {
    // 遷移・onExpire・クォータ解放を 1 tx にまとめる(expirePendingRequests と同じ契約)。
    // onExpire が throw した行は expire 自体も戻り、次の回に再試行される
    const strategy = getPurchaseCompletionStrategy(row.purchase_type);
    const moved = await db.transaction(async (tx) => {
      const moved = await transitionStatus({ id: row.id, to: "expired", from: ["processing"], tx });
      if (!moved) return false; // 他プロセスで既に遷移済み

      if (strategy?.onExpire) {
        await strategy.onExpire({ purchaseRequest: { ...row, status: "expired" } as PurchaseRequest, tx });
      }
      await releaseQuota(row.id, tx);
      return true;
    });
    return moved ? "expired" : "kept";
  } catch (error) {
    console.error(`[settleStaleClientSdkSession] 遷移に失敗: id=${row.id}`, error);
    return "kept";
  }
}

/**
 * 同一ユーザーの放置された client_sdk processing リクエストを片付ける(best-effort)。
 *
 * initiatePurchase の新規作成(create)経路の直前に呼ぶ。失敗しても新規購入はブロックしない(ログのみ)。
 */
export async function expireStaleClientSdkSessions(userId: string): Promise<void> {
  const rows = await db
    .select()
    .from(PurchaseRequestTable)
    .where(and(eq(PurchaseRequestTable.user_id, userId), eq(PurchaseRequestTable.status, "processing")));

  for (const row of rows) {
    // launchType を見て client_sdk 型のみ対象にする(redirect 型はユーザーが画面外へ
    // 遷移しているため、同一画面での放置という前提が成り立たない)
    if (!isClientSdkProvider(row.payment_provider)) continue;
    await settleStaleClientSdkSession(row as PurchaseRequest);
  }
}

/** 1 ページの件数(1 行ごとにプロバイダへ 1 回照会する) */
const SETTLE_PAGE_SIZE = 5;
/** 1 回の実行で照らす件数の上限 */
const SETTLE_MAX_ITEMS = 200;
/** 1 回の実行の時間予算(Vercel 既定の maxDuration 300s に、1 ページ = 照会 5 回の所要と pending の片付けの余裕を残す) */
const SETTLE_BUDGET_MS = 120_000;

export type SettleExpiredClientSdkSessionsResult = Record<StaleSessionOutcome, number>;

/**
 * 期限(expires_at)を過ぎた client_sdk の processing 行を、全利用者について片付ける(cron expire-pending-purchases)。
 * 次の initiate が来ない利用者の行も、ここで照らして閉じる。予算つき(runBudgetedBatches)、1 回 SETTLE_MAX_ITEMS 件まで
 */
export async function settleExpiredClientSdkSessions(now: Date = new Date()): Promise<SettleExpiredClientSdkSessionsResult> {
  const counts: SettleExpiredClientSdkSessionsResult = { completed: 0, failed: 0, expired: 0, kept: 0 };
  const clientSdkProviders = [...new Set(
    (await db
      .selectDistinct({ provider: PurchaseRequestTable.payment_provider })
      .from(PurchaseRequestTable)
      .where(and(eq(PurchaseRequestTable.status, "processing"), lt(PurchaseRequestTable.expires_at, now))))
      .map((row) => row.provider)
      .filter((provider) => isClientSdkProvider(provider)),
  )];
  if (clientSdkProviders.length === 0) return counts;

  await runBudgetedBatches<PurchaseRequest, string>({
    deadline: createDeadline(SETTLE_BUDGET_MS),
    maxItems: SETTLE_MAX_ITEMS,
    fetchNext: async (cursor) => {
      // kept の行は processing のまま残るので、カーソル(id の順)で先へ進む
      const after = cursor ? gt(PurchaseRequestTable.id, cursor) : undefined;
      const rows = (await db
        .select()
        .from(PurchaseRequestTable)
        .where(
          and(
            eq(PurchaseRequestTable.status, "processing"),
            lt(PurchaseRequestTable.expires_at, now),
            inArray(PurchaseRequestTable.payment_provider, clientSdkProviders),
            after,
          ),
        )
        .orderBy(asc(PurchaseRequestTable.id))
        .limit(SETTLE_PAGE_SIZE)) as PurchaseRequest[];
      if (rows.length === 0) return null;
      const last = rows[rows.length - 1];
      return { items: rows, cursor: last.id, done: rows.length < SETTLE_PAGE_SIZE };
    },
    processChunk: async (rows) => {
      for (const row of rows) counts[await settleStaleClientSdkSession(row)] += 1;
    },
  });
  return counts;
}
