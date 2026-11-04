// src/featureGate/evaluate.ts
// 判定の中身(server と client の道具が共有する。外には出さない: 公開の口は gate の束)。
// - 名前: 1 つでも閉なら閉(規則は 1 機能 1 ファイルなので名前 1 つに規則 1 つ)。未知の名前は throw
// - 住所: 一覧の順(ファイル名の順)で最初の閉じた規則が答え(行き先 redirectTo もその規則の物)

import { matchesPath } from "@/lib/pathPattern/index.mjs";

import { rules } from "./extensions/rules";
import type { ClosedPathEntry } from "./hiddenHref";
import type { FeatureName, GatedFeatureRule, GatePathResult } from "./types";

const byName = new Map<string, GatedFeatureRule>(rules.map((rule) => [rule.name, rule]));

/** 機能が有効か。未知の名前は throw(型をすり抜けた文字列・消えた規則の名前を黙って通さない) */
export function isFeatureEnabled(name: FeatureName): boolean {
  const rule = byName.get(name);
  if (!rule) throw new Error(`featureGate: 未知の機能の名前 "${String(name)}"(src/featureGate/rules/<名前>.ts が無い)`);
  return rule.enabled();
}

/** 住所が開いているか。閉じていれば一覧の順で最初の閉じた規則の名前(rule)と redirectTo */
export function resolvePath(pathname: string, list: readonly GatedFeatureRule[] = rules): GatePathResult {
  for (const rule of list) {
    if (rule.enabled()) continue;
    if (rule.pathPatterns.some((pattern) => matchesPath(pathname, pattern))) {
      return { open: false, rule: rule.name, redirectTo: rule.redirectTo };
    }
  }
  return { open: true };
}

/** 今の閉じた住所の並び(一覧の順・規則の中は pathPatterns の順)。隠す判定 hiddenHref.ts に渡す */
export function closedPathEntries(list: readonly GatedFeatureRule[] = rules): ClosedPathEntry[] {
  return list
    .filter((rule) => !rule.enabled())
    .flatMap((rule) => rule.pathPatterns.map((pattern) => ({ pattern, redirectTo: rule.redirectTo })));
}
