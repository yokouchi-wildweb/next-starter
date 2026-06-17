// src/lib/userDirty/context.ts

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * リクエストスコープで「再計算が必要になったユーザー」を収集するための ALS。
 *
 * 目的:
 * - 業務トランザクションの奥深く（紹介リワード付与・購入完了・将来の任意イベント）で
 *   確定した「対象 user_id」を、外側TXのコミット後にまとめて拾い上げる回収口を提供する。
 * - 収集箇所は `markUserDirty(userId)` を呼ぶだけ。DB には触れず TX を伸ばさない。
 * - flush（実際の再計算など）は下流が `registerUserDirtyFlushHandler` で差し込む。
 *   このモジュール自体は集計ロジックを持たない（汎用フック機構のみ提供）。
 *
 * 設計上の前提:
 * - flush は「業務トランザクションの外（コミット後）」で実行され、失敗しても業務は成功させる。
 * - 再計算は source からの冪等な全再計算である想定のため、over-mark（取りこぼしの逆）は無害。
 *   厳密なコミット成否との紐付けは行わない。
 * - 日次フル再計算等の安全網が別途あり、flush が取りこぼしても自己修復される前提。
 *
 * Next.js 16 / Node.js 18+ で stable。`Promise` / `setTimeout` 等は自動で context を伝播する。
 */
type UserDirtyStore = { dirty: Set<string> };

const userDirtyStore = new AsyncLocalStorage<UserDirtyStore>();

/**
 * コミット後の flush で呼ばれるハンドラ。
 * 収集された user_id 一覧を受け取る。下流で再計算等を実装して登録する。
 */
export type UserDirtyFlushHandler = (userIds: string[]) => Promise<void> | void;

const flushHandlers: UserDirtyFlushHandler[] = [];

/**
 * flush ハンドラを登録する。
 * 下流プロジェクトが起動時（registry 初期化等）に呼び、再計算処理を差し込む。
 *
 * 使用例:
 *   registerUserDirtyFlushHandler((userIds) => userMetricsService.recomputeUserMetrics(userIds));
 */
export function registerUserDirtyFlushHandler(handler: UserDirtyFlushHandler): void {
  flushHandlers.push(handler);
}

/**
 * 現在のリクエストスコープに、再計算対象の user_id をマークする。
 *
 * - ALS 内の Set へ push するだけ。DB アクセスなし・TX に乗らない。
 * - スコープ外（cron / CLI / テスト等）で呼ばれた場合は no-op。
 *   （非HTTP経路は日次フル再計算が安全網になる想定のため、ここでは何もしない）
 * - null / undefined / 空文字は無視する。
 */
export function markUserDirty(userId: string | null | undefined): void {
  if (!userId) return;

  const store = userDirtyStore.getStore();
  if (!store) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[userDirty] markUserDirty がトラッキングスコープ外で呼ばれました。無視します（日次安全網で補正される想定）:",
        userId,
      );
    }
    return;
  }

  store.dirty.add(userId);
}

/**
 * 再計算対象の収集スコープを敷いた状態で `fn` を実行する。
 * `fn` 完了後（＝業務トランザクションのコミット後）に、収集された user_id を flush する。
 *
 * routeFactory がリクエスト入口でハンドラ実行を本関数で包む（自動配線）。
 * flush は `finally` で実行されるため、`fn` が throw しても収集分は flush される
 * （over-mark は冪等再計算前提で無害）。flush 自体の失敗は握りつぶす。
 */
export async function runWithUserDirtyTracking<T>(fn: () => Promise<T> | T): Promise<T> {
  const store: UserDirtyStore = { dirty: new Set<string>() };
  try {
    return await userDirtyStore.run(store, fn);
  } finally {
    await flushDirtyUsers(store.dirty);
  }
}

/**
 * 収集された user_id を登録ハンドラへ渡す。
 * - 対象が無い / ハンドラ未登録なら即 return（ホットパスでの無駄な処理を避ける）。
 * - 各ハンドラの失敗は握りつぶす（業務には影響させない。安全網が補正する）。
 */
async function flushDirtyUsers(dirty: Set<string>): Promise<void> {
  if (dirty.size === 0 || flushHandlers.length === 0) return;

  const userIds = Array.from(dirty);
  for (const handler of flushHandlers) {
    try {
      await handler(userIds);
    } catch (error) {
      console.error("[userDirty] flush ハンドラが失敗しました（無視します）:", error);
    }
  }
}
