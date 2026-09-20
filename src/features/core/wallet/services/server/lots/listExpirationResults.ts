// src/features/core/wallet/services/server/lots/listExpirationResults.ts
// 失効スイープのユーザー単位の結果照会（失効後通知バッチ用データレイヤ）
//
// UI・通知の文言/送信はダウンストリーム所有。ここは結果の読み取りのみ。
//
// - 正本は wallet_histories（reason_category: "expiration" / source_type: "system"）。
//   スイープが同一TX内で per-user に記録しているため、取りこぼしが無く再読込もできる
// - スイープ本体にフックを持たせない理由: commit 後の通知呼び出しはプロセス断で失われ再送できず、
//   通知処理の遅さが没収 cron の実行時間を圧迫するため。通知は別 cron からこの関数で pull する
// - (created_at, id) の keyset ページング。1バッチの行は全て同じ created_at（TX開始時刻）を
//   持つため、タイムスタンプ単独のカーソルでは正しく前進できない
// - 既存インデックス wallet_histories_reason_category_created_at_idx に乗る

import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type {
  ListExpirationResultsParams,
  ListExpirationResultsResult,
} from "@/features/core/wallet/services/types";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/**
 * createdUntil 省略時の安全ラグ。
 * created_at は TX 開始時刻のため、commit 前の行を読み手が追い越すと、その行は
 * 「チェックポイントより過去」として永久に読まれなくなる。直近の行を読まないことで防ぐ。
 */
const SAFETY_LAG_MS = 5 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function assertDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainError(`${label} は有効な Date で指定してください。`, { status: 400 });
  }
}

// カーソルは PG のマイクロ秒精度を保った時刻文字列で持つ
// （JS Date はミリ秒精度のため、Date 経由にすると同一行を再取得して前進しなくなる）
function encodeCursor(createdAtText: string, id: string): string {
  return Buffer.from(`${createdAtText}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAtText: string; id: string } {
  const [createdAtText, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!createdAtText || !id || !CURSOR_TS_PATTERN.test(createdAtText) || !UUID_PATTERN.test(id)) {
    throw new DomainError("cursor の形式が不正です。", { status: 400 });
  }
  return { createdAtText, id };
}

/**
 * 失効スイープの結果（誰がいくら失効したか）を失効処理日時の昇順でページング取得する。
 *
 * - createdFrom は「含む」。cron_checkpoints（ミリ秒精度）を下限に使うと境界の行を再取得し得るため、
 *   通知側は historyId を冪等性キーにして重複を吸収すること
 * - createdUntil 省略時: requestBatchId 指定なし = 現在時刻 − 安全ラグ（5分）。
 *   requestBatchId 指定あり = 上限なし（スイープ完了後にその実行分を読む用途のため）
 */
export async function listExpirationResults(
  params: ListExpirationResultsParams = {},
): Promise<ListExpirationResultsResult> {
  const { walletType, requestBatchId, createdFrom, cursor } = params;
  if (createdFrom) assertDate(createdFrom, "createdFrom");
  if (params.createdUntil) assertDate(params.createdUntil, "createdUntil");
  if (requestBatchId && !UUID_PATTERN.test(requestBatchId)) {
    throw new DomainError("requestBatchId の形式が不正です。", { status: 400 });
  }

  const limit = Math.min(Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const createdUntil =
    params.createdUntil ?? (requestBatchId ? null : new Date(Date.now() - SAFETY_LAG_MS));

  const conditions = [
    eq(WalletHistoryTable.reason_category, "expiration"),
    eq(WalletHistoryTable.source_type, "system"),
    isNotNull(WalletHistoryTable.createdAt),
  ];
  if (walletType) conditions.push(eq(WalletHistoryTable.type, walletType));
  if (requestBatchId) conditions.push(eq(WalletHistoryTable.request_batch_id, requestBatchId));
  if (createdFrom) conditions.push(gte(WalletHistoryTable.createdAt, createdFrom));
  if (createdUntil) conditions.push(lt(WalletHistoryTable.createdAt, createdUntil));
  if (cursor) {
    const { createdAtText, id } = decodeCursor(cursor);
    conditions.push(
      sql`(${WalletHistoryTable.createdAt}, ${WalletHistoryTable.id}) > (${createdAtText}::timestamptz, ${id}::uuid)`,
    );
  }

  // 次ページ有無の判定用に1件多く取得する
  const rows = await db
    .select({
      historyId: WalletHistoryTable.id,
      userId: WalletHistoryTable.user_id,
      walletType: WalletHistoryTable.type,
      expiredAmount: WalletHistoryTable.points_delta,
      balanceBefore: WalletHistoryTable.balance_before,
      balanceAfter: WalletHistoryTable.balance_after,
      requestBatchId: WalletHistoryTable.request_batch_id,
      expiredAt: WalletHistoryTable.createdAt,
      createdAtText: sql<string>`to_char(${WalletHistoryTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(WalletHistoryTable)
    .where(and(...conditions))
    .orderBy(WalletHistoryTable.createdAt, WalletHistoryTable.id)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return {
    items: page.map((row) => ({
      historyId: row.historyId,
      userId: row.userId,
      walletType: row.walletType,
      expiredAmount: row.expiredAmount,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
      requestBatchId: row.requestBatchId,
      // 列定義上 nullable なだけで、IS NOT NULL 条件により null は来ない
      expiredAt: row.expiredAt!,
    })),
    nextCursor:
      rows.length > limit && last ? encodeCursor(last.createdAtText, last.historyId) : null,
  };
}
