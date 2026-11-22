// src/lib/pathPattern/pathPattern.test.mjs
// 住所のパターン照合: 前方一致・=・*(区切り 1 つ、D41 (5))・書き方の誤り・細かさ・ルートの被覆。実行: pnpm test src/lib/pathPattern

import assert from "node:assert/strict";
import { test } from "node:test";

import { matchesPath, patternCoversRoute, patternProblem, patternSpecificity } from "./index.mjs";

test("前方一致は区切りの境界、= はちょうど、/ は根だけ", () => {
  assert.equal(matchesPath("/demo", "/demo"), true);
  assert.equal(matchesPath("/demo/a/b", "/demo"), true);
  assert.equal(matchesPath("/demo-login", "/demo"), false);
  assert.equal(matchesPath("/demo/", "/demo/"), true);
  assert.equal(matchesPath("/mypage", "=/mypage"), true);
  assert.equal(matchesPath("/mypage/x", "=/mypage"), false);
  assert.equal(matchesPath("/", "/"), true);
  assert.equal(matchesPath("/x", "/"), false);
});

test("* は区切り 1 つの空でない何でも。前方一致・= と組み合わせる", () => {
  assert.equal(matchesPath("/wallet/coin/purchase", "/wallet/*/purchase"), true);
  assert.equal(matchesPath("/wallet/coin/purchase/done", "/wallet/*/purchase"), true);
  assert.equal(matchesPath("/wallet/purchase", "/wallet/*/purchase"), false);
  assert.equal(matchesPath("/wallet/a/b/purchase", "/wallet/*/purchase"), false);
  assert.equal(matchesPath("/wallet/coin/purchase/done", "=/wallet/*/purchase"), false);
  assert.equal(matchesPath("/wallet/coin", "/wallet/*"), true);
  assert.equal(matchesPath("/wallet", "/wallet/*"), false);
});

test("書き方の誤り: / 始まりでない・空の区切り・**・区切りの一部の *", () => {
  assert.equal(patternProblem("/wallet/*/purchase"), null);
  assert.equal(patternProblem("=/a/*"), null);
  assert.match(patternProblem("wallet") ?? "", /\/ で始める/);
  assert.match(patternProblem("/a//b") ?? "", /空の区切り/);
  assert.match(patternProblem("/a/**") ?? "", /\*\* は書けない/);
  assert.match(patternProblem("/a*b") ?? "", /区切りの一部の \*/);
});

test("細かさ: 区切りの数 → * の少なさ → =", () => {
  const order = ["/wallet", "/wallet/*/purchase", "=/wallet/*/purchase", "/wallet/coin/purchase", "=/wallet/coin/purchase", "/wallet/coin/purchase/x"];
  const sorted = [...order].sort((a, b) => patternSpecificity(a) - patternSpecificity(b));
  assert.deepEqual(sorted, order);
});

test("ルートの被覆: * は静的にも動的セグメントにも当たる、= は長さも同じ", () => {
  assert.equal(patternCoversRoute("/wallet/*/purchase", ["wallet", "[slug]", "purchase"]), true);
  assert.equal(patternCoversRoute("/wallet/*/purchase", ["wallet", "coin", "purchase", "done"]), true);
  assert.equal(patternCoversRoute("=/wallet/*", ["wallet", "coin", "purchase"]), false);
  assert.equal(patternCoversRoute("/wallet/*/purchase", ["wallet", "purchase"]), false);
});
