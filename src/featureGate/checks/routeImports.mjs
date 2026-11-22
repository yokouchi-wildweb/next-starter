// src/featureGate/checks/routeImports.mjs
// 無効な機能のドメインを読むルートの閉じ漏れの判定(featureGate.test.mjs の契約 2・3)。字面で読むだけの純関数(Node 組み込みも使わない)。
//
// 規則が閉じるドメイン = 規則の features のフォルダ(src/domains/core/<名前> か src/domains/<名前>)。表の数は問わない
// (表 0 のドメイン、例 Firestore 版の core/chatRoom も同じに見る)。features を持たない規則(住所の手書きだけ)は対象外。
// - ルート: そのドメインを `@/domains/(core/)?<名前>/` で参照するファイル(route.ts / page.tsx と _screen/ _components/ 配下)は、
//   規則の pathPatterns のどれかに覆われるか、そのファイルの中で規則の名前で門番に聞く(門番で包む、D54): gate.enabled("<規則>")・
//   gate.required("<規則>")・useGate().enabled("<規則>")・const <x> = useGate() の <x>.enabled("<規則>")(名前は文字列のリテラル、
//   注釈の中は数えない、同じファイルの中だけ)。例外の表は持たない(D22・D54)
// - 汎用 CRUD: ドメイン名(フォルダ名の末尾)が汎用 API の登録にあり、閉じていない(INTERNAL_ONLY でない)なら /api/<名前> が覆われる
// 使い手: scripts/structure/proxies/featureGate.test.mjs(実リポと fixture)

import { patternCoversRoute } from "../../lib/pathPattern/index.mjs";

/** 規則の features のフォルダ → ドメイン名(フォルダ名の末尾。core/<x> は x) */
export const domainsOfRule = (rule) => [...new Set((rule.domains ?? []).map((folder) => folder.split("/").pop()))];

/** features を持つ規則だけ(閉じるドメインのある規則) */
export const rulesWithFeatures = (rules) => rules.filter((rule) => (rule.domains ?? []).length > 0);

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 注釈を外す(行の // と /* … *\/。文字列の中の // は URL などで残るが、門番の呼び出しの字面は作らない) */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/**
 * ファイルが規則の名前で門番に聞いているか(門番で包む、D54)
 * @param {string} text ファイルの本文
 * @param {string} ruleName 規則の名前
 */
export function asksGate(text, ruleName) {
  const code = stripComments(text);
  const name = `\\(\\s*["']${escape(ruleName)}["']\\s*\\)`;
  if (new RegExp(`(?<![\\w.$])gate\\.(?:enabled|required)${name}`).test(code)) return true;
  if (new RegExp(`(?<![\\w.$])useGate\\(\\)\\.enabled${name}`).test(code)) return true;
  for (const m of code.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*useGate\(\)/g)) {
    if (new RegExp(`(?<![\\w.$])${escape(m[1])}\\.enabled${name}`).test(code)) return true;
  }
  return false;
}

/**
 * ルートの閉じ漏れ
 * @param {{ name: string, domains?: string[], pathPatterns: string[] }[]} rules 検査する規則(無効なもの)
 * @param {{ rel: string, segments: string[], text: string }[]} routeFiles rel = src/app 相対、segments = ルートの URL セグメント
 * @returns {string[]} 閉じていないファイルの説明
 */
export function findOpenRouteImports(rules, routeFiles) {
  const problems = [];
  for (const rule of rulesWithFeatures(rules)) {
    const domains = domainsOfRule(rule);
    for (const file of routeFiles) {
      const imported = domains.filter((domain) => new RegExp(`["']@/domains/(core/)?${escape(domain)}/`).test(file.text));
      if (imported.length === 0) continue;
      if (!rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, file.segments)) && !asksGate(file.text, rule.name)) {
        problems.push(`${file.rel}（${imported.join(", ")} を import）が規則「${rule.name}」(domains: ${rule.domains.join(", ")})で閉じていない`);
      }
    }
  }
  return problems;
}

/**
 * 汎用 CRUD(/api/<domain>)の閉じ漏れ
 * @param {{ name: string, domains?: string[], pathPatterns: string[] }[]} rules 検査する規則(無効なもの)
 * @param {(domain: string) => boolean} hasOpenGenericApi 汎用 API の登録にあり、閉じていない(INTERNAL_ONLY でない)か
 * @returns {string[]} 覆われていない住所
 */
export function findOpenGenericApis(rules, hasOpenGenericApi) {
  const problems = [];
  for (const rule of rulesWithFeatures(rules)) {
    for (const domain of domainsOfRule(rule)) {
      if (!hasOpenGenericApi(domain)) continue;
      if (!rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, ["api", domain]))) problems.push(`/api/${domain}`);
    }
  }
  return problems;
}
