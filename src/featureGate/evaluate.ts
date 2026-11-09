// src/featureGate/evaluate.ts
// 判定の中身(server と client の道具が共有する。外には出さない: 公開の口は gate の束)。
// - 名前: 1 つでも閉なら閉(規則は 1 機能 1 ファイルなので名前 1 つに規則 1 つ)。未知の名前は throw
// - 開閉は ruleList.ts の包み(全開スイッチを通した規則の enabled)だけを読む
// - 住所: 閉じた住所 = 閉じた規則の手書きの pathPatterns + 閉じたドメインの導出の住所(汎用 API・cron、ruleList.ts の closedDerivedEntries)。
//   当たった閉じた住所のうち一番細かい一致(@/lib/pathPattern の patternSpecificity: 長い住所、同じ長さは = の完全一致)が答え(rule と redirectTo、D34)。
//   同じ細かさは並びの順(手書き: 一覧の順 → 規則の中の順、その後に導出)

import { matchesPath, patternSpecificity } from "@/lib/pathPattern/index.mjs";

import { closedDerivedEntries, ruleEnabled, rules } from "./ruleList";
import type { ClosedPathEntry, FeatureName, GatedFeatureRule, GatePathResult } from "./types";

const byName = new Map<string, GatedFeatureRule>(rules.map((rule) => [rule.name, rule]));

/** 機能が有効か。未知の名前は throw(型をすり抜けた文字列・消えた規則の名前を黙って通さない) */
export function isFeatureEnabled(name: FeatureName): boolean {
  const rule = byName.get(name);
  if (!rule) throw new Error(`featureGate: 未知の機能の名前 "${String(name)}"(src/featureGate/rules/<名前>.ts が無い)`);
  return ruleEnabled(rule);
}

/** 住所が開いているか。閉じていれば当たった閉じた住所のうち一番細かい一致の規則の名前(rule)と redirectTo */
export function resolvePath(pathname: string, list: readonly GatedFeatureRule[] = rules): GatePathResult {
  const hit = closedPathEntries(list).find((entry) => matchesPath(pathname, entry.pattern));
  return hit ? { open: false, rule: hit.rule, redirectTo: hit.redirectTo } : { open: true };
}

/**
 * 今の閉じた住所の並び: 閉じた規則の手書きの住所(一覧の順・規則の中は pathPatterns の順)+ 閉じたドメインの導出の住所を、一番細かい順に並べ直した物
 * (同じ細かさは元の順)。並びの順で最初に当たった項目 = 一番細かい一致。gate.path・隠す判定 hiddenHref.ts・client の useGate().path がこの順で読む
 */
export function closedPathEntries(list: readonly GatedFeatureRule[] = rules): ClosedPathEntry[] {
  const handWritten = list
    .filter((rule) => !ruleEnabled(rule))
    .flatMap((rule) =>
      rule.pathPatterns.map(
        (pattern): ClosedPathEntry =>
          rule.redirectTo === undefined
            ? { pattern, rule: rule.name }
            : { pattern, rule: rule.name, redirectTo: rule.redirectTo },
      ),
    );
  const entries = [...handWritten, ...closedDerivedEntries(list)];
  return entries
    .map((entry, index) => ({ entry, index, specificity: patternSpecificity(entry.pattern) }))
    .sort((a, b) => b.specificity - a.specificity || a.index - b.index)
    .map(({ entry }) => entry);
}
