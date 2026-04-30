// src/lib/audit/context.ts

import { AsyncLocalStorage } from "node:async_hooks";

import type { AuditContext } from "./types";

/**
 * 監査コンテキスト用の AsyncLocalStorage。
 * routeFactory がリクエスト入口で `runWithAuditContext` を呼んでスコープを開き、
 * 呼び出しチェーン内のあらゆる server 側コードが `getAuditContext()` で参照できる。
 *
 * Next.js 16 / Node.js 18+ で stable。`Promise` / `setTimeout` 等は自動で context を伝播する。
 */
const auditContextStore = new AsyncLocalStorage<AuditContext>();

/**
 * 渡された context をスコープに敷いた状態で `fn` を実行する。
 * fn 内部の同期 / 非同期処理は `getAuditContext()` で context を参照可能。
 *
 * 使用例:
 * - API route: ハンドラ実行を本関数で包む（routeFactory が自動で行う）
 * - cron / batch: 起動時に system context を敷く（`runAsSystem` ヘルパー参照）
 * - test: 期待する context を敷いて wrapper をテスト
 */
export function runWithAuditContext<T>(context: AuditContext, fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve(auditContextStore.run(context, fn));
}

/**
 * 現在のスコープに紐づく context を取得する。
 * スコープ外（バッチ起動直後等）では null を返す。
 */
export function getAuditContext(): AuditContext | null {
  return auditContextStore.getStore() ?? null;
}

/**
 * context が必須の場面で使う。スコープ外の場合は例外。
 */
export function requireAuditContext(): AuditContext {
  const ctx = auditContextStore.getStore();
  if (!ctx) {
    throw new Error(
      "AuditContext is not set. Wrap server-side entry points with runWithAuditContext() or runAsSystem().",
    );
  }
  return ctx;
}

/**
 * バッチ / cron / CLI 起動時に system context を敷くためのヘルパー。
 * 該当処理の中で行われる audit 書き込みは `actorType: "system"` として記録される。
 */
export function runAsSystem<T>(
  fn: () => Promise<T> | T,
  options?: { requestId?: string },
): Promise<T> {
  const context: AuditContext = {
    actorId: null,
    actorType: "system",
    ip: null,
    userAgent: null,
    sessionId: null,
    requestId: options?.requestId ?? crypto.randomUUID(),
  };
  return runWithAuditContext(context, fn);
}
