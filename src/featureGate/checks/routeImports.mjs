// src/featureGate/checks/routeImports.mjs
// 無効な機能のドメインを読むルートの閉じ漏れの判定(featureGate.test.mjs の契約 2・3)。字面で読むだけの純関数(Node 組み込みも使わない)。
//
// 規則が閉じるドメイン = 規則の features のフォルダ(src/features/core/<名前> か src/features/<名前>)。表の数は問わない
// (表 0 のドメイン、例 Firestore 版の core/chatRoom も同じに見る)。features を持たない規則(住所の手書きだけ)は対象外。
// - ルート: そのドメインを `@/features/(core/)?<名前>/` で参照するファイル(route.ts / page.tsx と _screen/ _components/ 配下)は、
//   規則の pathPatterns のどれかに覆われる。意図して閉じないルートは例外表に理由付きで書く
// - 汎用 CRUD: ドメイン名(フォルダ名の末尾)が汎用 API の登録にあり、閉じていない(INTERNAL_ONLY でない)なら /api/<名前> が覆われる
// 使い手: scripts/structure/proxies/featureGate.test.mjs(実リポと fixture)

import { patternCoversRoute } from "../../lib/pathPattern/index.mjs";

/** 規則の features のフォルダ → ドメイン名(フォルダ名の末尾。core/<x> は x) */
export const domainsOfRule = (rule) => [...new Set((rule.features ?? []).map((folder) => folder.split("/").pop()))];

/** features を持つ規則だけ(閉じるドメインのある規則) */
export const rulesWithFeatures = (rules) => rules.filter((rule) => (rule.features ?? []).length > 0);

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * ルートの閉じ漏れ
 * @param {{ name: string, features?: string[], pathPatterns: string[] }[]} rules 検査する規則(無効なもの)
 * @param {{ rel: string, segments: string[], text: string }[]} routeFiles rel = src/app 相対、segments = ルートの URL セグメント
 * @param {Record<string, string>} exceptions src/app 相対 → 理由
 * @returns {string[]} 閉じていないファイルの説明
 */
export function findOpenRouteImports(rules, routeFiles, exceptions = {}) {
  const problems = [];
  for (const rule of rulesWithFeatures(rules)) {
    const domains = domainsOfRule(rule);
    for (const file of routeFiles) {
      if (file.rel in exceptions) continue;
      const imported = domains.filter((domain) => new RegExp(`["']@/features/(core/)?${escape(domain)}/`).test(file.text));
      if (imported.length === 0) continue;
      if (!rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, file.segments))) {
        problems.push(`${file.rel}（${imported.join(", ")} を import）が規則「${rule.name}」(features: ${rule.features.join(", ")})で閉じていない`);
      }
    }
  }
  return problems;
}

/**
 * 汎用 CRUD(/api/<domain>)の閉じ漏れ
 * @param {{ name: string, features?: string[], pathPatterns: string[] }[]} rules 検査する規則(無効なもの)
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
