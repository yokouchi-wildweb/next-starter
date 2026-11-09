// src/featureGate/ruleList.ts
// 判定の入口(門番の中で 1 つ): 生成一覧 extensions/rules を包み、各規則の enabled を依存先まで解いた開閉に差し替えた一覧を出す。
// - 自分の開閉: rules = 全開スイッチで開いていれば true、でなければ規則の enabled()(省略 = 開)/ configRules = 規則の enabled() だけ(スイッチを通さない)
// - 機能が開く = 自分が開 && dependsOn の機能が全部開(推移的。D24・D34)。依存の解決はここ 1 か所(resolveFeatureOpen)
// 門番の判定(evaluate・clientState・node の道具)と node.ts の rules を受け取る外の読み手(pnpm generate routes・検査)は、この一覧と ruleEnabled だけを通る。
// configRules: コミットされるファイルと検査が env で揺れない道具が読む(L2.3。
// pnpm generate cron / pnpm check cron・pnpm generate routes・FEATURE_GATE_CHECK の検査・codemod。node.ts の configRules / configPath)
// 全開スイッチの名前指定は依存先を開けない(D34): 閉じた依存先があれば開かず、足りない名前を値ごとに 1 回 console.warn(pnpm ops features list にも出る)
// 守り(scripts/structure/proxies/openSwitch.test.ts): 門番の中で extensions/rules を値で読むのも、規則の .enabled() を直に呼ぶのもこのファイルだけ
// スイッチ: ./openSwitch.ts / 詳細: ./README.md「機能どうしの依存(dependsOn)」

import { rules as generatedRules } from "./extensions/rules";
import { currentOpenSwitch, type OpenSwitch } from "./openSwitch";
import type { FeatureName, GatedFeatureRule, GeneratedFeatureRule } from "./types";

/** 依存の解決に要る形(名前と dependsOn だけ) */
export type FeatureDependencyNode = { name: string; dependsOn: readonly string[] };

const knownNames: ReadonlySet<string> = new Set(generatedRules.map((rule) => rule.name));
const generatedByName = new Map<string, GeneratedFeatureRule>(generatedRules.map((rule) => [rule.name, rule]));

const unknownName = (name: string) => new Error(`featureGate: 未知の機能の名前 "${name}"(src/featureGate/rules/<名前>.ts が無い)`);

/**
 * 依存先まで解いた開閉(純関数): 開 = self(name) && dependsOn の全部が開(推移的)。
 * 輪は生成器が止める(pnpm generate extensions)。作り物の一覧で輪に当たれば throw
 */
export function resolveFeatureOpen(list: readonly FeatureDependencyNode[], self: (name: string) => boolean): (name: string) => boolean {
  const byName = new Map(list.map((node) => [node.name, node]));
  const open = (name: string, trail: readonly string[]): boolean => {
    const node = byName.get(name);
    if (!node) throw unknownName(name);
    if (trail.includes(name)) throw new Error(`featureGate: dependsOn が輪になっている(${[...trail, name].join(" → ")})`);
    return self(name) && node.dependsOn.every((dep) => open(dep, [...trail, name]));
  };
  return (name) => open(name, []);
}

/** 推移的な依存先(純関数。近い順・重複なし) */
export function transitiveDependencies(list: readonly FeatureDependencyNode[], name: string): string[] {
  const byName = new Map(list.map((node) => [node.name, node]));
  const out: string[] = [];
  const queue = [...(byName.get(name)?.dependsOn ?? [])];
  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (dep === name || out.includes(dep)) continue;
    out.push(dep);
    queue.push(...(byName.get(dep)?.dependsOn ?? []));
  }
  return out;
}

/** 推移的な依存元(純関数。一覧の順) */
export function transitiveDependents(list: readonly FeatureDependencyNode[], name: string): string[] {
  return list.filter((node) => node.name !== name && transitiveDependencies(list, node.name).includes(name)).map((node) => node.name);
}

/** 規則の値そのもの(スイッチも依存先も通さない。enabled の省略 = 開) */
const ownValue = (rule: GeneratedFeatureRule): boolean => rule.enabled?.() ?? true;

/** 全開スイッチで開いているか(スイッチの値に未知の名前があれば throw)。依存先は見ない(開くかは ruleEnabled) */
export function isOpenedBySwitch(name: FeatureName): boolean {
  return openedBy(currentOpenSwitch(knownNames), name);
}

const openedBy = (opened: OpenSwitch, name: string) => opened === "all" || (opened !== null && opened.has(name));

/** 自分の開閉(スイッチ込み): スイッチで開いている || 規則の値 */
const selfWithSwitch = (name: string): boolean => {
  const rule = generatedByName.get(name);
  if (!rule) throw unknownName(name);
  return isOpenedBySwitch(name as FeatureName) || ownValue(rule);
};
/** 自分の開閉(規則の値だけ) */
const selfConfig = (name: string): boolean => {
  const rule = generatedByName.get(name);
  if (!rule) throw unknownName(name);
  return ownValue(rule);
};

const openWithSwitch = resolveFeatureOpen(generatedRules, selfWithSwitch);
const openConfig = resolveFeatureOpen(generatedRules, selfConfig);

/**
 * 全開スイッチの名前指定で開けた機能の、閉じた依存先(足りない名前)。キー = 名前で開けた機能、値 = 推移的な依存先のうち
 * 自分が閉(スイッチにも無く規則の値も閉)の物。"all" と未設定は空(純関数。self = スイッチ込みの自分の開閉)
 */
export function missingSwitchDependencies(
  list: readonly FeatureDependencyNode[],
  opened: OpenSwitch,
  self: (name: string) => boolean,
): Record<string, string[]> {
  if (opened === null || opened === "all") return {};
  const out: Record<string, string[]> = {};
  for (const name of opened) {
    const missing = transitiveDependencies(list, name).filter((dep) => !self(dep));
    if (missing.length > 0) out[name] = missing;
  }
  return out;
}

let warnedFor: OpenSwitch = null;

/** 名前指定のスイッチの足りない名前を、値ごとに 1 回 console.warn(currentOpenSwitch は値ごとに同じ答えを返す) */
function warnMissingOnce(): void {
  const opened = currentOpenSwitch(knownNames);
  if (opened === null || opened === "all" || opened === warnedFor) return;
  warnedFor = opened;
  const missing = missingSwitchDependencies(generatedRules, opened, selfWithSwitch);
  const lines = Object.entries(missing).map(([name, deps]) => `${name} ← ${deps.join(", ")}`);
  if (lines.length > 0) {
    console.warn(`featureGate: FEATURE_GATE_OPEN で開けた機能の依存先が閉じているため閉のまま(依存先も名前に足す): ${lines.join(" / ")}`);
  }
}

/** 規則の一覧(生成一覧の順)。enabled() = (スイッチで開いている || 規則の enabled()) && 依存先が全部開(呼ぶたびに読む) */
export const rules: GatedFeatureRule[] = generatedRules.map((rule) => ({
  ...rule,
  enabled: () => {
    warnMissingOnce();
    return openWithSwitch(rule.name);
  },
}));

/** 規則の値だけの一覧(生成一覧の順)。enabled() = 規則の enabled() && 依存先の規則の値が全部開(スイッチを通さない、呼ぶたびに読む) */
export const configRules: GatedFeatureRule[] = generatedRules.map((rule) => ({
  ...rule,
  enabled: () => openConfig(rule.name),
}));

/** 規則が開いているか(門番の判定はこれを呼ぶ。渡すのはこの一覧の規則か、テストの作り物) */
export function ruleEnabled(rule: Pick<GatedFeatureRule, "enabled">): boolean {
  return rule.enabled();
}

/** 規則の値で開いているか(スイッチを通さない、依存先は通す = configRules と同じ答え)。未知の名前は throw */
export function configEnabled(name: FeatureName): boolean {
  if (!generatedByName.has(name)) throw unknownName(name);
  return openConfig(name);
}

/** 規則の値そのもの(スイッチも依存先も通さない。enabled の省略 = 開。pnpm ops features list の閉の理由)。未知の名前は throw */
export function ownEnabled(name: FeatureName): boolean {
  return selfConfig(name);
}

/** 今の全開スイッチの名前指定の足りない名前(pnpm ops features list の見せ方。キー = 名前で開けた機能) */
export function switchMissingDependencies(): Record<string, string[]> {
  return missingSwitchDependencies(generatedRules, currentOpenSwitch(knownNames), selfWithSwitch);
}
