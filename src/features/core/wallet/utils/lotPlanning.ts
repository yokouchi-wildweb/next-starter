// src/features/core/wallet/utils/lotPlanning.ts
// 付与履歴から「現在残高を構成するロット」を復元する純粋関数
//
// ロット会計は FIFO（失効日が近い順に消費）なので、残高は常に「新しい付与の側」に残る。
// よって履歴を新しい順に辿り、残高を使い切るまで付与額を割り当てればロットを復元できる。
// 履歴の範囲（expirationDays ぶん）で割り当てきれなかった残りは、既に期限を過ぎた分である。

import { calcExpiresAt } from "./expiration";

/** ロット復元に使う履歴1件（INCREMENT / SET のみ。DECREMENT は不要） */
export type LotHistoryEntry = {
  changeMethod: "INCREMENT" | "SET";
  /** INCREMENT = 付与額（points_delta） / SET = 上書き後の残高（balance_after） */
  amount: number;
  createdAt: Date;
};

export type PlannedLot = {
  grantedAmount: number;
  remaining: number;
  expiresAt: Date;
};

export type LotPlan = {
  lots: PlannedLot[];
  /** 履歴の範囲で割り当てきれなかった額（= 既に期限を過ぎている分）。無ければ 0 */
  overdueAmount: number;
};

/**
 * 現在残高と付与履歴からロットを復元する。
 *
 * - entries は新しい順（createdAt 降順）で渡すこと
 * - SET は取得時期の情報を破壊する操作のため、その時点で残り全額を取得した扱いにして打ち切る
 *   （lotAccounting の rebaselineLots と同じ解釈）
 * - 不変条件: 返すロットの remaining 合計 = balance
 */
export function planLotsFromHistory(params: {
  balance: number;
  entries: LotHistoryEntry[];
  expirationDays: number;
  /** 期限を過ぎた分のロットに付ける失効日時（実行開始時刻を渡す） */
  overdueExpiresAt: Date;
}): LotPlan {
  const { balance, entries, expirationDays, overdueExpiresAt } = params;
  const lots: PlannedLot[] = [];
  let rest = Math.max(0, balance);

  for (const entry of entries) {
    if (rest <= 0) break;

    if (entry.changeMethod === "SET") {
      lots.push({
        grantedAmount: rest,
        remaining: rest,
        expiresAt: calcExpiresAt(entry.createdAt, expirationDays),
      });
      rest = 0;
      break;
    }

    if (entry.amount <= 0) continue;
    const take = Math.min(entry.amount, rest);
    lots.push({
      grantedAmount: entry.amount,
      remaining: take,
      expiresAt: calcExpiresAt(entry.createdAt, expirationDays),
    });
    rest -= take;
  }

  if (rest > 0) {
    lots.push({ grantedAmount: rest, remaining: rest, expiresAt: overdueExpiresAt });
  }

  return { lots, overdueAmount: rest };
}
