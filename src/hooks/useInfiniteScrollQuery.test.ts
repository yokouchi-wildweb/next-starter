// src/hooks/useInfiniteScrollQuery.test.ts — pnpm test src/hooks/useInfiniteScrollQuery.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeHasMore, computeNextFetchPosition } from "./useInfiniteScrollQuery";

test("削除なしなら lastFetchedPage + 1 を先頭から取る", () => {
  assert.deepEqual(computeNextFetchPosition(0, 20, 0), { page: 1, skip: 0 });
  assert.deepEqual(computeNextFetchPosition(2, 20, 0), { page: 3, skip: 0 });
});

test("limit 未満の削除は同じページを取り直し、取得済みの分を捨てる", () => {
  assert.deepEqual(computeNextFetchPosition(2, 20, 3), { page: 2, skip: 17 });
  assert.deepEqual(computeNextFetchPosition(1, 20, 1), { page: 1, skip: 19 });
});

test("ちょうど limit 件の削除は同じページを先頭から取る", () => {
  assert.deepEqual(computeNextFetchPosition(2, 20, 20), { page: 2, skip: 0 });
});

test("limit を超える削除は前のページまで戻る", () => {
  assert.deepEqual(computeNextFetchPosition(2, 20, 25), { page: 1, skip: 15 });
});

test("initialPage > 1 で始めても絶対位置で数える", () => {
  // page 5 から 1 ページ (行 80..99) 読み、2 件外した → 次は行 98 から
  assert.deepEqual(computeNextFetchPosition(5, 20, 2), { page: 5, skip: 18 });
});

test("取得済み以上を外しても負の位置にならない", () => {
  assert.deepEqual(computeNextFetchPosition(1, 20, 30), { page: 1, skip: 0 });
});

test("limit が 0 以下なら補正しない", () => {
  assert.deepEqual(computeNextFetchPosition(2, 0, 3), { page: 3, skip: 0 });
});

// フックの取得手順 (位置算出 → サーバーのページ → skip で切り落として追記) を素の配列で再現する
test("removeItems の後の読み込みで、詰まった行を読み飛ばさない", () => {
  const limit = 10;
  let server = Array.from({ length: 45 }, (_, i) => i);
  const fetchServerPage = (page: number) => server.slice((page - 1) * limit, page * limit);

  // 2 ページ読む
  let items = [...fetchServerPage(1), ...fetchServerPage(2)];
  let lastFetchedPage = 2;
  let removedSinceFetch = 0;

  // 読み込み済みの 3 行をサーバーとクライアントの両方から外す
  const removed = new Set([2, 11, 19]);
  server = server.filter((row) => !removed.has(row));
  items = items.filter((row) => !removed.has(row));
  removedSinceFetch += removed.size;

  // 次の読み込みを 2 回 (補正つき → 通常)
  for (let i = 0; i < 2; i += 1) {
    const { page, skip } = computeNextFetchPosition(lastFetchedPage, limit, removedSinceFetch);
    const batch = fetchServerPage(page);
    items = [...items, ...batch.slice(skip)];
    lastFetchedPage = page;
    removedSinceFetch = 0;
    assert.equal(computeHasMore(items.length, server.length, batch.length, limit), true);
  }

  // 補正つきの 1 回目は詰まった 3 行 (行 20..22) だけ、2 回目は通常の 1 ページ (行 23..32)
  assert.equal(items.length, 30);
  // 外した行を除いたサーバーの並びと先頭から一致する = 重複も欠けもない
  const expected = Array.from({ length: 33 }, (_, i) => i).filter((row) => !removed.has(row));
  assert.deepEqual(items, expected);
  assert.deepEqual(items, server.slice(0, items.length));
});
