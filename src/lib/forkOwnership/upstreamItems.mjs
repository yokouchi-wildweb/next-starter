// src/lib/forkOwnership/upstreamItems.mjs
// 実際のリポを読むテストの、上流の決まった値の比べ方(テストの部品)。上流のテストは fork でも走るので、fork が決まりどおりに
// 足した・変えた物(自分の項目・設定値・機能の入切)で落ちないようにする: Tier1 は今の完全な一致、fork は上流の項目を含むこと。
// 設定の既定は持ち主の既定値(<owner>ConfigDef.defaults)、門は今の答えから期待を作る(この部品の外。.claude/rules/core/scripts.md tests)
import assert from "node:assert/strict";

import { readForkIdentity } from "./forkIds.mjs";

/**
 * そのリポが Tier1(上流の頂)か。名前と段の読み手 readForkIdentity の isTier1
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function isTier1Repo(repoRoot) {
  return readForkIdentity(repoRoot).isTier1;
}

/**
 * 上流の項目の一覧を確かめる: Tier1 は完全な一致(同じ順)。fork は上流の項目が全部あること
 * (ordered: 上流の項目どうしの順も同じ。fork の項目は間に入ってよい)
 * @param {readonly string[]} actual 実際の一覧
 * @param {readonly string[]} upstream 上流が持つ項目
 * @param {{ repoRoot: string, ordered?: boolean, message?: string }} options
 */
export function assertUpstreamItems(actual, upstream, { repoRoot, ordered = false, message }) {
  if (isTier1Repo(repoRoot)) {
    assert.deepEqual([...actual], [...upstream], message);
    return;
  }
  if (ordered) {
    const present = actual.filter((item) => upstream.includes(item));
    assert.deepEqual(present, [...upstream], message ?? `上流の項目が欠けているか順が違う: ${actual.join(", ")}`);
    return;
  }
  for (const item of upstream) assert.ok(actual.includes(item), message ?? `上流の項目 ${item} が無い: ${actual.join(", ")}`);
}
