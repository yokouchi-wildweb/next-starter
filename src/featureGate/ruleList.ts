// src/featureGate/ruleList.ts
// 判定の入口(門番の中で 1 つ): 生成一覧 extensions/rules を包み、各規則の enabled を依存先まで解いた開閉に差し替えた一覧を出す。
// - 規則の値(ownValue): (src/config/featureGate/switches.config.ts の fork の値 ?? 規則の defaultEnabled ?? 開) && 規則の enabled()(入切でない条件、省略 = 開)。D35
// - 自分の開閉: rules = 全開スイッチで開いていれば true、でなければ規則の値 / configRules = 規則の値だけ(全開スイッチを通さない)
// - 機能が開く = 自分が開 && dependsOn の機能が全部開(推移的。D24・D34)&& anyOf を書けばどれか 1 つが開(D36)。依存の解決はここ 1 か所(resolveFeatureOpen)
// 門番の判定(evaluate・clientState・node の道具)と node.ts の rules を受け取る外の読み手(pnpm generate routes・検査)は、この一覧と ruleEnabled だけを通る。
// configRules: コミットされるファイルと検査が env で揺れない道具が読む(L2.3。
// pnpm generate cron / pnpm check cron・pnpm generate routes・FEATURE_GATE_CHECK の検査・codemod。node.ts の configRules / configPath)
// ドメインの開閉(D24・D34 K4): ドメイン = どれかの規則の features に載るフォルダ(生成一覧の domains)。開 = そのドメインを features に持つ規則のどれかが開。
//   表・汎用 API の住所(apiPaths)・cron の task(読むドメインが全部開のとき開)はドメインの開閉で決まる(closedDomainsOf・closedDerivedEntries)。
//   設定の節(settingSections)は節自身の判定: 名指す機能が全部開のときだけ開く(closedDerivedEntries)
//   渡した一覧(rules / configRules / テストの作り物)の開閉で解くので、スイッチの効く・効かないは一覧で決まる
// 全開スイッチの名前指定は依存先を開けない(D34): 閉じた依存先があれば開かず、足りない名前を値ごとに 1 回 console.warn(pnpm ops features list にも出る)
// 守り(scripts/structure/proxies/openSwitch.test.ts): 門番の中で extensions/rules を値で読むのも、規則の .enabled() を直に呼ぶのもこのファイルだけ
// スイッチ: ./openSwitch.ts / 詳細: ./README.md「機能どうしの依存(dependsOn)」

import switches from "@/config/featureGate/switches.config";

import { cronTasks, domains, rules as generatedRules, settingSections } from "./extensions/rules";
import { currentOpenSwitch, type OpenSwitch } from "./openSwitch";
import type { ClosedPathEntry, FeatureName, GatedDomain, GatedFeatureRule, GeneratedFeatureRule } from "./types";

/** 依存の解決に要る形(名前と dependsOn、anyOf は省略可) */
export type FeatureDependencyNode = { name: string; dependsOn: readonly string[]; anyOf?: readonly string[] };

const knownNames: ReadonlySet<string> = new Set(generatedRules.map((rule) => rule.name));
const generatedByName = new Map<string, GeneratedFeatureRule>(generatedRules.map((rule) => [rule.name, rule]));

const unknownName = (name: string) => new Error(`featureGate: 未知の機能の名前 "${name}"(src/featureGate/rules/<名前>.ts が無い)`);

/** fork の入切の値の検査(純関数): 未知の機能の名前・真偽でない値を並べる(空 = 通る) */
export function switchProblems(values: Readonly<Record<string, unknown>>, known: ReadonlySet<string>): string[] {
  return Object.entries(values).flatMap(([name, value]) => [
    ...(known.has(name) ? [] : [`未知の機能の名前 "${name}"(src/featureGate/rules/<名前>.ts が無い)`]),
    ...(typeof value === "boolean" ? [] : [`"${name}" の値が true|false でない`]),
  ]);
}

// fork の入切の値に未知の名前があれば読み込みで throw(打ち間違いを黙って既定のままにしない。型でも落ちる)
const switchValues: Readonly<Record<string, boolean | undefined>> = switches;
const switchErrors = switchProblems(switchValues, knownNames);
if (switchErrors.length > 0) throw new Error(`featureGate: src/config/featureGate/switches.config.ts: ${switchErrors.join(" / ")}`);

/**
 * 依存先まで解いた開閉(純関数): 開 = self(name) && dependsOn の全部が開(推移的)&& (anyOf が空 || anyOf のどれかが開)。
 * 輪は生成器が止める(pnpm generate extensions)。作り物の一覧で輪に当たれば throw
 */
export function resolveFeatureOpen(list: readonly FeatureDependencyNode[], self: (name: string) => boolean): (name: string) => boolean {
  const byName = new Map(list.map((node) => [node.name, node]));
  const open = (name: string, trail: readonly string[]): boolean => {
    const node = byName.get(name);
    if (!node) throw unknownName(name);
    if (trail.includes(name)) throw new Error(`featureGate: dependsOn が輪になっている(${[...trail, name].join(" → ")})`);
    const anyOf = node.anyOf ?? [];
    return (
      self(name) &&
      node.dependsOn.every((dep) => open(dep, [...trail, name])) &&
      (anyOf.length === 0 || anyOf.some((dep) => open(dep, [...trail, name])))
    );
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

/** 規則の値そのもの(全開スイッチも依存先も通さない): (fork の入切 ?? 規則の既定 ?? 開) && 入切でない条件(省略 = 開) */
const ownValue = (rule: GeneratedFeatureRule): boolean => (switchValues[rule.name] ?? rule.defaultEnabled ?? true) && (rule.enabled?.() ?? true);

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

/** 規則の値そのもの(全開スイッチも依存先も通さない: fork の入切 ?? 規則の既定 ?? 開、かつ入切でない条件。pnpm ops features list の閉の理由)。未知の名前は throw */
export function ownEnabled(name: FeatureName): boolean {
  return selfConfig(name);
}

/** 今の全開スイッチの名前指定の足りない名前(pnpm ops features list の見せ方。キー = 名前で開けた機能) */
export function switchMissingDependencies(): Record<string, string[]> {
  return missingSwitchDependencies(generatedRules, currentOpenSwitch(knownNames), selfWithSwitch);
}

// ---- ドメインの開閉と導出の住所(D24・D34 K4) ----

/** 規則の一覧の形(ドメインの開閉に要る物だけ) */
type DomainHolder = Pick<GatedFeatureRule, "name" | "features" | "enabled" | "redirectTo">;

/**
 * 導出の住所: 汎用 API(ドメイン 1 つ)・cron の task(読むドメインの全部)・設定の節(名指す機能の全部)。
 * folders = 開に要るドメイン、features = 開に要る機能(どちらも全部開で開)。並び = domains の順 → cronTasks の順 → settingSections の順
 */
export type DerivedPath = { pattern: string; kind: "domainApi" | "cron" | "setting"; folders: readonly string[]; features?: readonly string[] };

export const derivedPaths: readonly DerivedPath[] = [
  ...domains.flatMap((domain) => domain.apiPaths.map((pattern): DerivedPath => ({ pattern, kind: "domainApi", folders: [domain.folder] }))),
  ...cronTasks.map((task): DerivedPath => ({ pattern: task.path, kind: "cron", folders: task.folders })),
  ...settingSections.map((section): DerivedPath => ({ pattern: section.path, kind: "setting", folders: [], features: section.features })),
];

/** 生成一覧のドメインの表(フォルダの順) */
export const gatedDomains: readonly GatedDomain[] = domains;

/**
 * 閉じたドメイン(純関数に近い: 開閉は渡した一覧の enabled で読む)。キー = フォルダ、値 = 閉じた持ち主のうち一覧の順で最初の規則。
 * 開 = 一覧の中でそのフォルダを features に持つ規則のどれかが開。一覧のどの規則も持たないフォルダは閉じない(基盤と同じ)
 */
export function closedDomainsOf<R extends DomainHolder>(list: readonly R[], domainList: readonly Pick<GatedDomain, "folder">[] = domains): Map<string, R> {
  const closed = new Map<string, R>();
  for (const domain of domainList) {
    const holders = list.filter((rule) => (rule.features ?? []).includes(domain.folder));
    if (holders.length > 0 && holders.every((rule) => !ruleEnabled(rule))) closed.set(domain.folder, holders[0]);
  }
  return closed;
}

/** ドメインが開いているか(渡した一覧の開閉で。生成一覧の domains に無いフォルダ = どの規則にも載らない = 常に開) */
export function domainEnabled(folder: string, list: readonly DomainHolder[] = rules): boolean {
  return !closedDomainsOf(list, [{ folder }]).has(folder);
}

/**
 * 閉じた導出の住所(汎用 API: ドメインが閉 / cron: 読むドメインのどれかが閉 / 設定の節: 名指す機能のどれかが閉)。
 * rule・redirectTo = 閉じたドメインの持ち主と閉じた名指しの機能のうち一覧の順で最初の規則(一覧に無い名指しは数えない)。
 * 並びは導出の住所の順(evaluate.ts が手書きの住所と合わせて一番細かい順に並べ直す)
 */
export function closedDerivedEntries(list: readonly DomainHolder[] = rules, paths: readonly DerivedPath[] = derivedPaths): ClosedPathEntry[] {
  const closed = closedDomainsOf(list);
  const order = new Map(list.map((rule, index) => [rule.name, index]));
  const entries: ClosedPathEntry[] = [];
  for (const path of paths) {
    const owners = [
      ...path.folders.map((folder) => closed.get(folder)),
      ...(path.features ?? []).map((name) => list.find((rule) => rule.name === name && !ruleEnabled(rule))),
    ].filter((rule): rule is DomainHolder => rule !== undefined);
    if (owners.length === 0) continue;
    const owner = owners.reduce((a, b) => ((order.get(b.name) ?? 0) < (order.get(a.name) ?? 0) ? b : a));
    entries.push(owner.redirectTo === undefined ? { pattern: path.pattern, rule: owner.name } : { pattern: path.pattern, rule: owner.name, redirectTo: owner.redirectTo });
  }
  return entries;
}

/** 閉じたドメインの表名(db:push・pnpm ops db clear。一覧の開閉で、domains の順・重複なし) */
export function closedDomainTables(list: readonly DomainHolder[] = rules): string[] {
  const closed = closedDomainsOf(list);
  return [...new Set(domains.filter((domain) => closed.has(domain.folder)).flatMap((domain) => domain.tables))];
}

/**
 * 規則が閉じれば閉じる住所の全部: その規則だけを閉じた(ほかは開)ときの閉じた住所(手書き + 導出、依存元の住所も)。評価そのもの(resolveFeatureOpen と
 * closedDerivedEntries)で数えるので、1 つのドメインを複数の機能が持てば、規則 1 本を閉じてもそのドメインの住所は入らない。
 * 読み手の検査(依存・常時実行の入口・ルートの被覆)が読む。生成一覧に無い規則(テストの作り物)は自分の手書きの住所だけ
 */
export function coveredPatternsOf(rule: Pick<GatedFeatureRule, "name" | "pathPatterns" | "features">): string[] {
  if (!generatedByName.has(rule.name)) return [...rule.pathPatterns];
  const open = resolveFeatureOpen(generatedRules, (name) => name !== rule.name);
  const list = generatedRules.map((r) => ({ ...r, enabled: () => open(r.name) }));
  const handWritten = list.filter((r) => !r.enabled()).flatMap((r) => r.pathPatterns);
  return [...new Set([...handWritten, ...closedDerivedEntries(list).map((entry) => entry.pattern)])];
}

/** 一覧の各規則の pathPatterns を coveredPatternsOf(手書き + 規則のドメインの導出の住所)にした写し(enabled はそのまま)。住所で覆うかを見る検査の入力 */
export function withCoveredPatterns<R extends Pick<GatedFeatureRule, "name" | "pathPatterns" | "features">>(list: readonly R[]): R[] {
  return list.map((rule) => ({ ...rule, pathPatterns: coveredPatternsOf(rule) }));
}
