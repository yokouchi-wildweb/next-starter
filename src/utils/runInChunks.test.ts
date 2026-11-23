// 長い並びを束に分けて順に処理する道具(./runInChunks.ts)の検査
// 実行: pnpm test src/utils/runInChunks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { ChunkRunError, chunksOf, runInChunks } from "./runInChunks";

test("chunksOf: 決まった大きさに分け、最後は短い。空なら束 0。大きさは正の整数", () => {
  assert.deepEqual(chunksOf([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunksOf([1, 2], 5), [[1, 2]]);
  assert.deepEqual(chunksOf([], 3), []);
  assert.throws(() => chunksOf([1], 0), RangeError);
});

test("runInChunks: 束ごとに順に(並列にせず)呼び、結果を束の順に返す。上限以下は 1 回だけ", async () => {
  const seen: number[][] = [];
  let running = 0;
  const results = await runInChunks([1, 2, 3, 4, 5], 2, async (chunk, index) => {
    running += 1;
    assert.equal(running, 1, "同時に 2 束を送らない");
    seen.push(chunk);
    await new Promise((resolve) => setTimeout(resolve, 0));
    running -= 1;
    return `${index}:${chunk.join("")}`;
  });
  assert.deepEqual(seen, [[1, 2], [3, 4], [5]]);
  assert.deepEqual(results, ["0:12", "1:34", "2:5"]);
  assert.deepEqual(await runInChunks([1, 2], 1000, async (chunk) => chunk.length), [2]);
});

test("runInChunks: 途中の束で失敗したらそこで止め、済んだ束の結果と何束目までを持って投げる", async () => {
  const calls: number[] = [];
  const failure = new Error("上限を超えています");
  await assert.rejects(
    runInChunks([1, 2, 3, 4, 5], 2, async (chunk, index) => {
      calls.push(index);
      if (index === 1) throw failure;
      return chunk.length;
    }),
    (error) => {
      assert.ok(error instanceof ChunkRunError);
      assert.equal(error.doneChunks, 1);
      assert.equal(error.totalChunks, 3);
      assert.deepEqual(error.results, [2]);
      assert.equal(error.cause, failure);
      assert.match(error.message, /上限を超えています\(3 束のうち 1 束まで済み\)/);
      return true;
    },
  );
  assert.deepEqual(calls, [0, 1], "失敗の後の束は送らない");
});
