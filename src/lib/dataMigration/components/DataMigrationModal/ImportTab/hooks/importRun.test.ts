// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importRun.test.ts
//
// インポートの進め方（importRun.ts）のテスト: 最初に失敗したチャンクで止め、後のチャンクと後に続くドメインは流さない。
// 入ったもの・入っていないものを結果に分ける。
// 実行: pnpm test:data-migration

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { ChunkResult } from "../../types";
import { chunkNameOf, runImportSteps, sortImportSteps, type ImportStep } from "./importRun";

const steps: ImportStep[] = [
  { name: "category", type: "related", chunkCount: 1, chunkPrefix: "category" },
  { name: "sample", type: "main", chunkCount: 3, chunkPrefix: "sample" },
  { name: "sample_to_tag", type: "junction", chunkCount: 2, chunkPrefix: "sample_to_tag" },
];

/** failAt = 失敗させるチャンク（"<domain>/<chunkName>"）。呼ばれた順を calls に残す */
function fakeProcess(failAt: string | null, calls: string[]) {
  return async (step: ImportStep, chunkIndex: number): Promise<ChunkResult> => {
    const chunkName = chunkNameOf(chunkIndex);
    const key = `${step.name}/${chunkName}`;
    calls.push(key);
    if (key === failAt) return { chunkName, domain: step.name, success: false, recordCount: 0, error: "boom" };
    return { chunkName, domain: step.name, success: true, recordCount: 10 };
  };
}

describe("importRun", () => {
  test("チャンク名: 0 始まりの番号 → chunk_001", () => {
    assert.equal(chunkNameOf(0), "chunk_001");
    assert.equal(chunkNameOf(11), "chunk_012");
  });

  test("並び: related → main → hasMany → junction（同じ種類はマニフェストの順）", () => {
    const sorted = sortImportSteps([
      { name: "j", type: "junction" },
      { name: "h", type: "hasMany" },
      { name: "m", type: "main" },
      { name: "r1", type: "related" },
      { name: "r2", type: "related" },
    ]);
    assert.deepEqual(sorted.map((s) => s.name), ["r1", "r2", "m", "h", "j"]);
  });

  test("全部成功: 全チャンクを順に流し、止まらない", async () => {
    const calls: string[] = [];
    const outcome = await runImportSteps(steps, fakeProcess(null, calls));
    assert.deepEqual(calls, [
      "category/chunk_001",
      "sample/chunk_001",
      "sample/chunk_002",
      "sample/chunk_003",
      "sample_to_tag/chunk_001",
      "sample_to_tag/chunk_002",
    ]);
    assert.equal(outcome.stoppedAt, null);
    assert.deepEqual(outcome.notRunChunks, []);
    assert.equal(outcome.successfulChunks, 6);
    assert.equal(outcome.failedChunks, 0);
    assert.equal(outcome.totalRecords, 60);
  });

  test("途中で失敗: そこで止め、同じドメインの残りと後のドメイン（中間テーブル）は流さない", async () => {
    const calls: string[] = [];
    const outcome = await runImportSteps(steps, fakeProcess("sample/chunk_002", calls));
    assert.deepEqual(calls, ["category/chunk_001", "sample/chunk_001", "sample/chunk_002"]);
    assert.equal(outcome.stoppedAt?.domain, "sample");
    assert.equal(outcome.stoppedAt?.chunkName, "chunk_002");
    assert.equal(outcome.stoppedAt?.error, "boom");
    // 入ったもの: 失敗より前の 2 チャンク
    assert.equal(outcome.successfulChunks, 2);
    assert.equal(outcome.totalRecords, 20);
    assert.equal(outcome.failedChunks, 1);
    // 入っていないもの: 失敗した 1 + 流さなかった 3
    assert.deepEqual(outcome.notRunChunks, [
      { domain: "sample", chunkName: "chunk_003" },
      { domain: "sample_to_tag", chunkName: "chunk_001" },
      { domain: "sample_to_tag", chunkName: "chunk_002" },
    ]);
    assert.deepEqual(
      outcome.domainResults.map((d) => [d.domain, d.successfulChunks, d.failedChunks, d.totalRecords]),
      [
        ["category", 1, 0, 10],
        ["sample", 1, 1, 10],
        ["sample_to_tag", 0, 0, 0],
      ],
    );
  });

  test("最初のチャンクで失敗: 何も入らず、残りは全部流さない", async () => {
    const calls: string[] = [];
    const outcome = await runImportSteps(steps, fakeProcess("category/chunk_001", calls));
    assert.deepEqual(calls, ["category/chunk_001"]);
    assert.equal(outcome.successfulChunks, 0);
    assert.equal(outcome.totalRecords, 0);
    assert.equal(outcome.notRunChunks.length, 5);
  });
});
