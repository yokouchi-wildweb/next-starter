// src/features/core/wallet/services/server/wrappers/reverseHistory.ts
//
// 取引の取り消し: wallet_histories の行を、逆向きの調整を同じ 1 つの transaction で入れ直して打ち消す(README「取引の取り消し」)。
// - 選び方: 行の id(複数可)か、一括操作の 1 回分 request_batch_id(全部の行)
// - 逆向き: INCREMENT → DECREMENT、DECREMENT → INCREMENT、同じ通貨・同じ額。書き込みは adjustBalance(残高・ロット・履歴・監査)
// - 取り消しの行: 元の行と同じ reason_category・reason_key(区分ごと・種類ごとの集計で元の行が打ち消される)、source_type admin_action、
//   meta.reversesHistoryId = 元の行の id、全部の行で 1 つの新しい request_batch_id
// - 止める(何も書かない): SET の行(逆が 1 つに決まらない)・額 0 の行・取り消しの行そのもの・既に取り消した行・知らない id・空の束・
//   重なった id・今は書けない区分・種類(消した・付け替えた reason_key)・残高(利用可能・ロック中)が足りない DECREMENT。全部を先に確かめてから書く(途中で落ちても transaction ごと戻る)
// - 順: 新しい行から順に戻す(created_at の降順)。残高の確かめもその順に当てる
// - dryRun: 確かめと計画だけ(何も書かない)
// 呼び手: 運用コマンド pnpm task wallet:reverse-history(scripts/tasks/reverse-history.ts)。後で管理画面からも同じ関数を呼ぶ(L1.34)

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Wallet } from "@/features/core/wallet/entities";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { DomainError } from "@/lib/errors/domainError";

import { adjustBalance } from "./adjustBalance";
import { resolveWalletReason } from "./reasonKey";
import { getWallet, runWithTransaction, type TransactionClient } from "./utils";

/** 取り消しの行の meta に書く鍵(元の行の id) */
export const REVERSES_HISTORY_META_KEY = "reversesHistoryId";

export type ReverseHistoryParams = {
  /** 行の id(どちらか一方) */
  historyIds?: string[];
  /** 一括操作の 1 回分(どちらか一方) */
  requestBatchId?: string;
  /** 取り消しの理由(履歴の reason と監査に残る。必須) */
  reason: string;
  /** 確かめと計画だけ(何も書かない) */
  dryRun?: boolean;
};

export type ReverseHistoryPlanRow = {
  historyId: string;
  userId: string;
  walletType: WalletTypeValue;
  /** 取り消しの増減(元の行の逆の符号) */
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  /** 書いた取り消しの行(dryRun では null) */
  newHistoryId: string | null;
};

export type ReverseHistoryResult = {
  dryRun: boolean;
  /** 取り消しの行の request_batch_id(dryRun では null) */
  requestBatchId: string | null;
  rows: ReverseHistoryPlanRow[];
};

type HistoryRow = typeof WalletHistoryTable.$inferSelect;

const reversesOf = (row: HistoryRow): unknown => (row.meta as Record<string, unknown> | null)?.[REVERSES_HISTORY_META_KEY];

/** 選んだ行を読む(並べ替えは呼び手) */
async function loadRows(trx: TransactionClient, params: ReverseHistoryParams): Promise<HistoryRow[]> {
  const ids = params.historyIds ?? [];
  if ((ids.length > 0) === Boolean(params.requestBatchId)) {
    throw new DomainError("取り消す行は historyIds か requestBatchId のどちらか一方で選んでください。", { status: 400 });
  }
  if (ids.length > 0) {
    if (new Set(ids).size !== ids.length) throw new DomainError("同じ行の id が重なっています。", { status: 400 });
    const rows = await trx.select().from(WalletHistoryTable).where(inArray(WalletHistoryTable.id, ids));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) throw new DomainError(`知らない行の id です: ${missing.join(", ")}`, { status: 404 });
    return ids.map((id) => byId.get(id) as HistoryRow);
  }
  const rows = await trx
    .select()
    .from(WalletHistoryTable)
    .where(eq(WalletHistoryTable.request_batch_id, params.requestBatchId as string))
    .orderBy(WalletHistoryTable.createdAt, WalletHistoryTable.id);
  if (rows.length === 0) throw new DomainError(`request_batch_id ${params.requestBatchId} の行がありません。`, { status: 404 });
  return rows;
}

/** 既に取り消した行(取り消しの行の meta.reversesHistoryId が指す元の行の id)。user_id の index で絞って探す */
async function findReversed(trx: TransactionClient, rows: HistoryRow[]): Promise<Set<string>> {
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const ids = rows.map((row) => row.id);
  const found = await trx
    .select({ reverses: sql<string>`${WalletHistoryTable.meta} ->> ${REVERSES_HISTORY_META_KEY}` })
    .from(WalletHistoryTable)
    .where(and(
      inArray(WalletHistoryTable.user_id, userIds),
      sql`${WalletHistoryTable.meta} ->> ${REVERSES_HISTORY_META_KEY} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
    ));
  return new Set(found.map((row) => row.reverses));
}

/** 行ごとに止める理由を返す(空 = 取り消せる) */
function rowProblems(rows: HistoryRow[], reversed: Set<string>): string[] {
  const problems: string[] = [];
  for (const row of rows) {
    if (row.change_method === "SET") problems.push(`${row.id}: 残高を置き換えた行(SET)は逆が決まらないので取り消せません(手で調整する)`);
    else if (row.points_delta === 0) problems.push(`${row.id}: 額 0 の行は取り消すものがありません`);
    if (reversesOf(row) !== undefined) problems.push(`${row.id}: 取り消しの行そのものは取り消せません`);
    if (reversed.has(row.id)) problems.push(`${row.id}: 既に取り消しています`);
    try {
      resolveWalletReason({ reasonCategory: row.reason_category, reasonKey: row.reason_key });
    } catch (error) {
      problems.push(`${row.id}: 元の行の区分・種類では書けません(${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return problems;
}

/** 財布ごとに順に当てて、残高が足りるかを確かめた計画 */
async function plan(trx: TransactionClient, rows: HistoryRow[], lock: boolean): Promise<ReverseHistoryPlanRow[]> {
  const wallets = new Map<string, Wallet>();
  const out: ReverseHistoryPlanRow[] = [];
  const problems: string[] = [];
  for (const row of rows) {
    const key = `${row.user_id}:${row.type}`;
    let wallet = wallets.get(key);
    if (!wallet) {
      const found = await getWallet(trx, row.user_id, row.type, { lock, createIfNotExists: false });
      if (!found) {
        problems.push(`${row.id}: ユーザー ${row.user_id} の ${row.type} の財布がありません`);
        continue;
      }
      wallet = found;
    }
    const delta = row.change_method === "INCREMENT" ? -row.points_delta : row.points_delta;
    const after = wallet.balance + delta;
    if (delta < 0 && wallet.balance - wallet.locked_balance < -delta) {
      problems.push(`${row.id}: 利用可能な残高が足りません(残高 ${wallet.balance}、ロック中 ${wallet.locked_balance}、取り消す額 ${-delta})`);
    }
    out.push({ historyId: row.id, userId: row.user_id, walletType: row.type, delta, balanceBefore: wallet.balance, balanceAfter: after, newHistoryId: null });
    wallets.set(key, { ...wallet, balance: after });
  }
  if (problems.length > 0) throw new DomainError(`取り消せない行があるので、何もしていません:\n${problems.join("\n")}`, { status: 409 });
  return out;
}

export async function reverseHistory(params: ReverseHistoryParams, tx?: TransactionClient): Promise<ReverseHistoryResult> {
  const reason = params.reason?.trim();
  if (!reason) throw new DomainError("取り消しの理由(reason)を指定してください。", { status: 400 });
  const dryRun = params.dryRun === true;

  return runWithTransaction(tx, async (trx) => {
    const rows = await loadRows(trx, params);
    const problems = rowProblems(rows, await findReversed(trx, rows));
    if (problems.length > 0) throw new DomainError(`取り消せない行があるので、何もしていません:\n${problems.join("\n")}`, { status: 409 });
    // 新しい行から順に戻す(取り消し = 後からの操作を先に戻す。束で +50 → -20 の順に入れた物を作った順に戻すと途中で残高が足りなくなる)
    const ordered = [...rows].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) || b.id.localeCompare(a.id));
    const planned = await plan(trx, ordered, !dryRun);
    if (dryRun) return { dryRun, requestBatchId: null, rows: planned };

    const requestBatchId = randomUUID();
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const step of planned) {
      const original = byId.get(step.historyId) as HistoryRow;
      const { history } = await adjustBalance(
        {
          userId: original.user_id,
          walletType: original.type,
          changeMethod: step.delta < 0 ? "DECREMENT" : "INCREMENT",
          amount: Math.abs(step.delta),
          sourceType: "admin_action",
          requestBatchId,
          reason,
          reasonCategory: original.reason_category,
          reasonKey: original.reason_key,
          meta: { [REVERSES_HISTORY_META_KEY]: original.id, notes: reason },
        },
        trx,
        { lock: true },
      );
      step.newHistoryId = history?.id ?? null;
    }
    return { dryRun, requestBatchId, rows: planned };
  });
}
