// 生成前の検査（何も書く前に止めるもの）。各検査はエラー文（文字列・配列）か null を返す。ここで集めて、全件を並べて例外にする。
// domain.json の決まり（名前の形・必須キー・リレーション・型と入力欄・選択肢・既定値・メディア・一覧の設定）はここで止める。
// 対話で作っていた頃に質問の中にあった決まりもここに移した（domain.json は手で書き、pnpm forge か dc:generate で生成する）
//
// 生成の最中に見つかる検査（SET_NULL + required、hiddenColumns、index 名の長さ、ファイル用途の規則）は
// render/ の各生成器が例外を投げる。pipeline は全カテゴリの Output を集めてから書くので、どちらも書きかけを残さない。
// 語彙の照合（checks/vocabulary.mjs）は警告だけで、生成は止めない

import { auditIssues } from "./audit.mjs";
import { closableIssues } from "./closable.mjs";
import { checkDomainFolderName } from "./domainFolder.mjs";
import { fieldsIssues, fieldsWarnings } from "./fields.mjs";
import { formInputNameIssues } from "./formInputNames.mjs";
import { mediaIssues } from "./media.mjs";
import { checkMediaFieldsEngine } from "./mediaEngine.mjs";
import { nameIssues, nameWarnings } from "./names.mjs";
import { relationIssues } from "./relations.mjs";
import { requiredIssues } from "./required.mjs";
import { checkRetiredFieldTypes } from "./retiredFieldTypes.mjs";
import { viewConfigIssues, viewConfigWarnings } from "./viewConfig.mjs";
import { vocabularyReport } from "./vocabulary.mjs";

/** domain.json の中身の決まり（[camel] を前に付けて返す） */
export function configIssues(camel, config) {
  if (!config || typeof config !== "object") return [];
  return [
    ...requiredIssues(config),
    ...nameIssues(config),
    ...relationIssues(config),
    ...fieldsIssues(config),
    ...mediaIssues(config),
    ...viewConfigIssues(config),
    ...auditIssues(config),
    ...closableIssues(config),
  ].map((issue) => `[${camel}] ${issue}`);
}

/**
 * @param {import("../domain/context.mjs").DomainContext} ctx
 * @param {Set<string>} [registeredInputs] 登録された入力部品の名前
 * @returns {string[]} エラー文（空なら問題なし）
 */
export function preflightIssues(ctx, registeredInputs = new Set()) {
  return [
    ...(ctx.config && typeof ctx.config === "object" ? formInputNameIssues(ctx.config, registeredInputs).map((issue) => `[${ctx.camel}] ${issue}`) : []),
    checkDomainFolderName(ctx.camel, ctx.config),
    checkRetiredFieldTypes(ctx.camel, ctx.config),
    checkMediaFieldsEngine(ctx.camel, ctx.config),
    ...configIssues(ctx.camel, ctx.config),
  ].filter(Boolean);
}

/** 問題があれば全件を並べて例外を投げる（dc:generate の入口） */
export function assertPreflight(ctx, registeredInputs = new Set()) {
  const issues = preflightIssues(ctx, registeredInputs);
  if (issues.length > 0) throw new Error(issues.join("\n"));
}

/**
 * 止めない警告（domain.json の語彙）。`[domain.json] <camel>: ...` の形で返す。
 * 知らないキー（キーごとにまとめた行）は最後に並べる（値の誤り・DB の型・古いキーを先に読ませる）
 * @returns {string[]}
 */
export function preflightWarnings(ctx, registeredInputs = new Set()) {
  if (!ctx.config || typeof ctx.config !== "object") return [];
  const vocabulary = vocabularyReport(ctx.config, registeredInputs);
  return [
    ...vocabulary.warnings,
    ...nameWarnings(ctx.config),
    ...fieldsWarnings(ctx.config, registeredInputs),
    ...viewConfigWarnings(ctx.config),
    ...vocabulary.unknownKeys,
  ].map((w) => `[domain.json] ${ctx.camel}: ${w}`);
}
