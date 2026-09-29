// src/features/core/wallet/utils/lotPlanning.test.ts
// planLotsFromHistory の単体テスト
// 実行: pnpm test:wallet-lot-planning

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcExpiresAt } from "./expiration";
import { planLotsFromHistory, type LotHistoryEntry } from "./lotPlanning";

const EXPIRATION_DAYS = 180;
const RUN_START = new Date("2026-09-29T00:00:00.000Z");

/** 実行開始時刻から daysAgo 日前の時刻 */
function daysAgo(days: number): Date {
  const date = new Date(RUN_START);
  date.setDate(date.getDate() - days);
  return date;
}

function increment(amount: number, days: number): LotHistoryEntry {
  return { changeMethod: "INCREMENT", amount, createdAt: daysAgo(days) };
}

function set(balanceAfter: number, days: number): LotHistoryEntry {
  return { changeMethod: "SET", amount: balanceAfter, createdAt: daysAgo(days) };
}

function plan(balance: number, entries: LotHistoryEntry[]) {
  return planLotsFromHistory({
    balance,
    entries,
    expirationDays: EXPIRATION_DAYS,
    overdueExpiresAt: RUN_START,
  });
}

function sumRemaining(lots: { remaining: number }[]): number {
  return lots.reduce((total, lot) => total + lot.remaining, 0);
}

test("付与の合計が残高と一致する場合は付与ごとにロットを復元する", () => {
  const result = plan(300, [increment(100, 10), increment(200, 50)]);

  assert.equal(result.overdueAmount, 0);
  assert.deepEqual(result.lots, [
    { grantedAmount: 100, remaining: 100, expiresAt: calcExpiresAt(daysAgo(10), EXPIRATION_DAYS) },
    { grantedAmount: 200, remaining: 200, expiresAt: calcExpiresAt(daysAgo(50), EXPIRATION_DAYS) },
  ]);
});

test("残高が付与の合計より少ない場合は新しい付与から割り当て、古い付与は部分残になる", () => {
  const result = plan(250, [increment(100, 10), increment(200, 50), increment(500, 90)]);

  assert.equal(result.overdueAmount, 0);
  assert.deepEqual(
    result.lots.map((lot) => [lot.grantedAmount, lot.remaining]),
    [
      [100, 100],
      [200, 150],
    ],
  );
  assert.equal(sumRemaining(result.lots), 250);
});

test("SET は残り全額をその時点の取得扱いにして打ち切る", () => {
  const result = plan(250, [increment(200, 10), set(100, 40), increment(999, 60)]);

  assert.equal(result.overdueAmount, 0);
  assert.deepEqual(result.lots, [
    { grantedAmount: 200, remaining: 200, expiresAt: calcExpiresAt(daysAgo(10), EXPIRATION_DAYS) },
    { grantedAmount: 50, remaining: 50, expiresAt: calcExpiresAt(daysAgo(40), EXPIRATION_DAYS) },
  ]);
});

test("履歴で割り当てきれなかった残りは期限切れロット1本になる", () => {
  const result = plan(1000, [increment(100, 10), increment(200, 50)]);

  assert.equal(result.overdueAmount, 700);
  assert.deepEqual(result.lots[2], {
    grantedAmount: 700,
    remaining: 700,
    expiresAt: RUN_START,
  });
  assert.equal(sumRemaining(result.lots), 1000);
});

test("履歴が無い場合は残高の全額が期限切れロットになる", () => {
  const result = plan(500, []);

  assert.equal(result.overdueAmount, 500);
  assert.deepEqual(result.lots, [{ grantedAmount: 500, remaining: 500, expiresAt: RUN_START }]);
});

test("残高が 0 以下の場合はロットを作らない", () => {
  assert.deepEqual(plan(0, [increment(100, 10)]), { lots: [], overdueAmount: 0 });
  assert.deepEqual(plan(-10, [increment(100, 10)]), { lots: [], overdueAmount: 0 });
});

test("付与額が 0 以下の履歴は読み飛ばす", () => {
  const result = plan(100, [increment(0, 5), increment(-50, 8), increment(100, 10)]);

  assert.equal(result.overdueAmount, 0);
  assert.deepEqual(
    result.lots.map((lot) => [lot.grantedAmount, lot.remaining]),
    [[100, 100]],
  );
});

test("残高を使い切った後の履歴は無視する（SET も含む）", () => {
  const result = plan(100, [increment(100, 10), set(9999, 20), increment(300, 30)]);

  assert.equal(result.lots.length, 1);
  assert.equal(result.overdueAmount, 0);
});

test("不変条件: ロットの remaining 合計は常に残高と一致する", () => {
  const entries = [increment(30, 1), increment(70, 20), set(400, 60), increment(10, 100)];

  for (const balance of [1, 30, 31, 100, 101, 5000]) {
    const result = plan(balance, entries);
    assert.equal(sumRemaining(result.lots), balance, `balance=${balance}`);
  }
});
