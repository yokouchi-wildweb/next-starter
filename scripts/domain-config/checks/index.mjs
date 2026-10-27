// 生成前の検査（何も書く前に止めるもの）。各検査は文字列（エラー文）か null を返す。ここで集めて例外にする
//
// 生成の最中に見つかる検査（SET_NULL + required、hiddenColumns、index 名の長さ、ファイル用途の規則）は
// render/ の各生成器が例外を投げる。pipeline は全カテゴリの Output を集めてから書くので、どちらも書きかけを残さない。
// 語彙の照合（checks/vocabulary.mjs）は警告だけで、生成は止めない

import { checkDomainFolderName } from "./domainFolder.mjs";
import { checkMediaFieldsEngine } from "./mediaEngine.mjs";
import { vocabularyWarnings } from "./vocabulary.mjs";

/**
 * @param {import("../domain/context.mjs").DomainContext} ctx
 * @returns {string[]} エラー文（空なら問題なし）
 */
export function preflightIssues(ctx) {
  return [checkDomainFolderName(ctx.camel, ctx.config), checkMediaFieldsEngine(ctx.camel, ctx.config)].filter(Boolean);
}

/** 最初の問題で例外を投げる（dc:generate の入口） */
export function assertPreflight(ctx) {
  const [first] = preflightIssues(ctx);
  if (first) throw new Error(first);
}

/**
 * 止めない警告（domain.json の語彙）。`[domain.json] <camel>: ...` の形で返す
 * @returns {string[]}
 */
export function preflightWarnings(ctx) {
  return vocabularyWarnings(ctx.config).map((w) => `[domain.json] ${ctx.camel}: ${w}`);
}
