// src/features/messaging/services/server/dispatch.ts
//
// message_dispatches テーブルへの書き込みを集約するヘルパー。
// send / bulkSend どちらからも呼ばれる。
//
// ## 永続化の順序（二重送信防止の要）
// 1. createDispatch: 送信開始「前」に status='processing' で 1 行 INSERT する。
//    - この時点で本文・対象件数・冪等性キーが永続化されるため、以降どこで
//      異常終了しても「送信ジョブが走った（かもしれない）」痕跡が必ず残る
//    - idempotency_key には UNIQUE 制約があるため、同一キーの再実行は
//      メールを 1 通も送る前にここで 409 として拒否される
// 2. completeDispatch: 送信処理の完走後、成功/失敗件数と status='completed' を UPDATE する。

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { getAuditContext } from "@/lib/audit";
import { DomainError } from "@/lib/errors/domainError";

import { MessageDispatchTable } from "../../entities/drizzle";
import type { MessagingChannel } from "../../constants/channels";

export type DispatchCreateParams = {
  channels: MessagingChannel[];
  emailSubject: string | null;
  emailBody: string | null;
  notificationTitle: string | null;
  notificationBody: string | null;
  recipientCount: number;
  source: string;
  reason: string | null;
  /** 二重送信防止用の冪等性キー（クライアント発行）。null なら冪等性チェックなし */
  idempotencyKey: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DispatchCompleteParams = {
  dispatchId: string;
  emailSuccessCount: number;
  emailFailedCount: number;
  notificationCreated: boolean | null;
};

/**
 * 送信ジョブを status='processing' で 1 行 INSERT し、生成された id を返す。
 * 必ず送信処理の「前」に呼ぶこと。
 * actor_id / actor_type は ALS から自動取得する（取得できなければ null）。
 *
 * @throws DomainError(409) 同一 idempotencyKey のジョブが既に存在する場合
 */
export async function createDispatch(
  params: DispatchCreateParams,
): Promise<string> {
  const ctx = getAuditContext();

  try {
    const [created] = await db
      .insert(MessageDispatchTable)
      .values({
        status: "processing",
        idempotency_key: params.idempotencyKey,
        channels: params.channels,
        email_subject: params.emailSubject,
        email_body: params.emailBody,
        notification_title: params.notificationTitle,
        notification_body: params.notificationBody,
        recipient_count: params.recipientCount,
        email_success_count: 0,
        email_failed_count: 0,
        notification_created: null,
        source: params.source,
        actor_id: ctx?.actorId ?? null,
        actor_type: ctx?.actorType ?? null,
        reason: params.reason,
        metadata: params.metadata ?? null,
      })
      .returning({ id: MessageDispatchTable.id });

    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError(
        "この送信操作は既に実行されています（二重送信防止）。送信状況は送信記録を確認してください。",
        { status: 409 },
      );
    }
    throw error;
  }
}

/**
 * 送信処理の完走後に件数を確定し、status='completed' に更新する。
 *
 * 呼び出し側はこの UPDATE の失敗で送信全体を 500 にしないこと
 * （メールは既に送信済みであり、throw すると呼び出し元に「失敗した」と誤認させて
 * 再実行 = 二重送信を誘発する。行は processing のまま残るので追跡は可能）。
 */
export async function completeDispatch(
  params: DispatchCompleteParams,
): Promise<void> {
  await db
    .update(MessageDispatchTable)
    .set({
      status: "completed",
      email_success_count: params.emailSuccessCount,
      email_failed_count: params.emailFailedCount,
      notification_created: params.notificationCreated,
      completed_at: new Date(),
    })
    .where(eq(MessageDispatchTable.id, params.dispatchId));
}

/**
 * 渡した冪等性キーのうち、既に送信ジョブが存在するものを返す（単一クエリ）。
 *
 * バッチ送信が再実行で同じ対象を読み直したとき、1件ずつ send() を呼んで 409 を受ける代わりに
 * ページ単位で送信済みを除外するためのもの。存在判定のみで、送信の成否は区別しない
 * （冪等性キーの行は送信「前」に作られるため、送信に失敗した行も「存在する」側に入る）。
 */
export async function findExistingIdempotencyKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .select({ key: MessageDispatchTable.idempotency_key })
    .from(MessageDispatchTable)
    .where(inArray(MessageDispatchTable.idempotency_key, keys));
  return new Set(rows.flatMap((row) => (row.key ? [row.key] : [])));
}

/**
 * PostgreSQL の UNIQUE 制約違反 (SQLSTATE 23505) かどうかを判定する。
 * ドライバ・ラッパーにより code がエラー本体 / cause のどちらに乗るか揺れるため両方を見る。
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }
  return false;
}
