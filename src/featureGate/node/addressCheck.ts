// src/featureGate/node/addressCheck.ts(入口 @/featureGate/node の checkAddresses。検査 pnpm test src/featureGate scripts/structure/proxies が読む)
//
// 読み込み後の一覧の住所の検査(D25・D31・D34 K5): 規則の値(決済の通貨の slug など実行時に組む住所)も導出の住所(汎用 API・cron・設定の節)も入った一覧で見る。
// - 二重書き: 同じ住所を 2 つ以上の持ち主が持ち、持ち主に共通の機能が無い(URL は 1 つの機能にだけ属する)。
//   手書きの持ち主 = その規則、導出の住所の持ち主 = ドメインを持つ機能(cron は読むドメインの持ち主)・節が名指す機能
// - 入れ子の依存: 前方一致の住所 A の下(A そのものでない)に住所 B を持つ持ち主が、A の持ち主に dependsOn していない(推移的に。同じ機能は可)。
//   住所の入れ子は依存を表す(覆う機能のどれかが閉なら閉)ので、暗黙の依存を明示にそろえる。直し方: B の機能の dependsOn に A の機能を足す
//   (根拠の無い入れ子は両方に依存する小さな機能へ移す、D34 K3)
// 上流の例外は理由つきの表(当たらない行は失敗)

import { matchesPath, isExactPattern } from "@/lib/pathPattern/index.mjs";

import { derivedPaths as defaultDerivedPaths, transitiveDependencies, type DerivedPath } from "../ruleList";
import type { GatedFeatureRule } from "../types";

/** 上流の例外: 住所(正規化) → 理由 */
export const ADDRESS_EXCEPTIONS: Readonly<Record<string, string>> = {
  "/api/notificationTemplate":
    "テンプレートの汎用 API はお知らせ(notification)のドメインの導出で、管理画面の機能 adminNotificationTemplates(notification に dependsOn、既定で閉)も手書きで閉じる。管理画面を閉じれば API も閉じる今の答えを保つ(連絡の議会の次の区切り、テンプレートで送る機能・messaging への移行で見直す)",
};

type Rule = Pick<GatedFeatureRule, "name" | "pathPatterns" | "features" | "dependsOn">;
type Entry = { pattern: string; path: string; owners: string[]; source: string };

const normalize = (pattern: string) => {
  const body = isExactPattern(pattern) ? pattern.slice(1) : pattern;
  return body.length > 1 && body.endsWith("/") ? body.slice(0, -1) : body;
};

function entriesOf(list: readonly Rule[], derived: readonly DerivedPath[]): Entry[] {
  const holders = (folder: string) => list.filter((rule) => (rule.features ?? []).includes(folder)).map((rule) => rule.name);
  const entries: Entry[] = [];
  for (const rule of list) for (const pattern of rule.pathPatterns) entries.push({ pattern, path: normalize(pattern), owners: [rule.name], source: `${rule.name} の手書き` });
  for (const path of derived) {
    const owners = [...new Set([...path.folders.flatMap(holders), ...(path.features ?? []).filter((name) => list.some((rule) => rule.name === name))])];
    if (owners.length === 0) continue;
    const via = path.kind === "setting" ? "設定の節" : path.kind === "cron" ? `cron(${path.folders.join("・")})` : `汎用 API(${path.folders.join("・")})`;
    entries.push({ pattern: path.pattern, path: normalize(path.pattern), owners, source: `${via} の導出` });
  }
  return entries;
}

/**
 * 住所の二重書きと入れ子の依存の欠けを返す(空 = 通る)。list は rules か configRules(住所は同じ)か作り物
 * @param exceptions 二重書きを許す住所(正規化) → 理由。当たらない行も problems に出す(一覧に持ち主の無い住所は数えない)
 */
export function checkAddresses(
  list: readonly Rule[],
  derived: readonly DerivedPath[] = defaultDerivedPaths,
  exceptions: Readonly<Record<string, string>> = ADDRESS_EXCEPTIONS,
): string[] {
  const problems: string[] = [];
  const entries = entriesOf(list, derived);
  const nodes = list.map((rule) => ({ name: rule.name, dependsOn: rule.dependsOn ?? [] }));
  const reach = new Map<string, Set<string>>(list.map((rule) => [rule.name, new Set<string>([rule.name, ...transitiveDependencies(nodes, rule.name)])]));

  // 二重書き
  const byPath = new Map<string, Entry[]>();
  for (const entry of entries) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry]);
  const usedExceptions = new Set<string>();
  for (const [path, group] of byPath) {
    if (group.length < 2) continue;
    const common = group.map((e) => new Set(e.owners)).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
    if (common.size > 0) continue;
    if (path in exceptions) {
      usedExceptions.add(path);
      continue;
    }
    problems.push(`住所 ${path} を 2 つの機能が持つ(${group.map((e) => e.source).join(" / ")})。1 つの機能にだけ書き、親と子なら親から消して子の dependsOn に親を足す`);
  }
  for (const path of Object.keys(exceptions)) {
    if (!usedExceptions.has(path) && byPath.has(path)) problems.push(`住所の二重書きの例外 ${path} はもう当たらない(src/featureGate/node/addressCheck.ts の行を消す)`);
  }

  // 入れ子の依存
  const seen = new Set<string>();
  for (const parent of entries) {
    if (isExactPattern(parent.pattern)) continue;
    for (const child of entries) {
      if (child.path === parent.path || !matchesPath(child.path, parent.pattern)) continue;
      const ok = child.owners.some((c) => parent.owners.some((p) => reach.get(c)?.has(p)));
      if (ok) continue;
      const key = `${parent.path}>${child.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(
        `住所 ${child.path}(${child.source})が ${parent.path}(${parent.source})の下にあるのに、${child.owners.join("・")} が ${parent.owners.join("・")} に dependsOn していない。dependsOn に ${parent.owners.map((n) => `"${n}"`).join(" か ")} を足す(依存の根拠が無ければ両方に依存する小さな機能へ住所を移す)`,
      );
    }
  }
  return problems;
}
