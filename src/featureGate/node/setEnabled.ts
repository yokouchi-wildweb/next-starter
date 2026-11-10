// src/featureGate/node/setEnabled.ts(入口 @/featureGate/node の planFeatureSet・applyFeatureSet。pnpm ops features set が使う)
//
// 機能の入切を書き換える(D35・設定 D91・D92)。書き先は Tier で決まる:
// - fork(Tier1 でない): src/config/featureGate/switches.config.ts の default export の直下の `<名前>: true|false`(無ければ足す。既定と同じでも消さない L1.26)
// - Tier1: 規則のファイル src/featureGate/rules/<名前>.ts の `defaultEnabled: true|false`(無ければ足す。上流は switches.config.ts を空で出荷し、出荷後に書かない)
// 必須(required/)の機能と、必須の機能が dependsOn で推移的に依存する機能を off にはしない(依存の連鎖を返す)。
// on にした機能の依存先が規則の値で閉なら、書いた上でその名前を返す(依存先が閉なので閉のまま。L3.1)。
// db:push・pnpm generate extensions は打たない(開けたら db:push が要ると案内する)。詳細: src/featureGate/README.md「pnpm ops features list / pnpm ops features set」

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

import { configRules, ruleEnabled, transitiveDependencies, type FeatureDependencyNode } from "../ruleList";
import type { GatedFeatureRule } from "../types";

/** fork の入切の値の置き場(repo 相対) */
export const SWITCHES_FILE = "src/config/featureGate/switches.config.ts";

export type FeatureSetPlan =
  /** closedDependencies = on にしたが規則の値で閉の直の依存先(書いても閉のまま)。off では空。configFile = 書き先(repo 相対) */
  | { kind: "write"; configFile: string; before: string; after: string; changed: boolean; closedDependencies: string[] }
  | { kind: "required"; reason: string }
  /** chains = 必須の機能からこの機能までの依存の連鎖(各 [必須の機能, …, この機能]) */
  | { kind: "requiredDependent"; chains: string[][] }
  | { kind: "unwritable"; why: string; enabledSource: string };

/** text の open の位置の { に対応する } の位置(文字列・template・コメントは飛ばす)。直下(深さ 1)の範囲も返す。合わなければ null */
function scanObject(text: string, open: number): { end: number; topLevel: Array<[number, number]> } | null {
  let depth = 0;
  let segmentStart = open + 1;
  const topLevel: Array<[number, number]> = [];
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i += 1; i < text.length && text[i] !== ch; i += 1) if (text[i] === "\\") i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
      if (i < 0) return null;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
      if (i <= 0) return null;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      if (depth === 1) topLevel.push([segmentStart, i]);
      depth += 1;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      depth -= 1;
      if (depth === 1) segmentStart = i + 1;
      if (depth === 0) {
        topLevel.push([segmentStart, i]);
        return { end: i, topLevel };
      }
    }
  }
  return null;
}

/**
 * オブジェクトのリテラル(text の open の位置の {)の直下の `<key>: true|false` を value にした本文(無ければ先頭に足す)。
 * 直下に同じ key が 2 つ以上ある・真偽のリテラルでない値・閉じない括弧は null
 */
export function rewriteTopLevelBoolean(text: string, open: number, key: string, value: boolean): string | null {
  const scanned = scanObject(text, open);
  if (!scanned) return null;
  const keyPattern = new RegExp(`(^|[\\s{,])${key}\\s*:\\s*([^,\\n}]*)`, "g");
  const hits: Array<{ start: number; end: number; literal: boolean }> = [];
  for (const [from, to] of scanned.topLevel) {
    const piece = text.slice(from, to);
    for (const m of piece.matchAll(keyPattern)) {
      const start = from + m.index + m[1].length;
      hits.push({ start, end: from + m.index + m[0].length, literal: /^(true|false)\s*$/.test(m[2]) });
    }
  }
  if (hits.length > 1 || (hits.length === 1 && !hits[0].literal)) return null;
  const entry = `${key}: ${value}`;
  if (hits.length === 1) {
    const line = text.slice(hits[0].start, hits[0].end);
    return text.slice(0, hits[0].start) + line.replace(/^(\S+\s*:\s*)(true|false)/, `$1${value}`) + text.slice(hits[0].end);
  }
  const inner = text.slice(open + 1, scanned.end);
  if (inner.trim() === "") return `${text.slice(0, open)}{ ${entry} }${text.slice(scanned.end + 1)}`;
  const newline = /^[ \t]*\n([ \t]*)/.exec(inner);
  const insert = newline ? `\n${newline[1]}${entry},` : ` ${entry},`;
  return text.slice(0, open + 1) + insert + text.slice(open + 1);
}

/**
 * switches.config.ts の本文の `<名前>: value` を書いた本文。default export がオブジェクトのリテラルでなければ null。
 * default export は行の頭のものだけを見る(上流の頭のコメントの例 `// 例: \`export default { … }\`` に書かない)
 */
export function rewriteSwitch(switchesText: string, name: string, value: boolean): string | null {
  const head = /^[ \t]*export\s+default\s*\{/m.exec(switchesText);
  if (!head) return null;
  return rewriteTopLevelBoolean(switchesText, head.index + head[0].length - 1, name, value);
}

/** 規則のファイルの本文の defaultEnabled を value にした本文。`export const rule ... = {` が無ければ null */
export function rewriteRuleDefault(ruleText: string, value: boolean): string | null {
  const head = /export\s+const\s+rule\b[^=]*=\s*\{/.exec(ruleText);
  if (!head) return null;
  return rewriteTopLevelBoolean(ruleText, head.index + head[0].length - 1, "defaultEnabled", value);
}

/**
 * 必須の機能からこの機能までの依存の連鎖(純関数): 必須の機能 R が dependsOn で推移的に name に依存すれば [R, …, name](最短、一覧の順)。
 * name 自身が必須なのは含めない(kind "required" の側)
 */
export function requiredDependencyChains(list: readonly FeatureDependencyNode[], name: string, requiredNames: readonly string[]): string[][] {
  const byName = new Map(list.map((node) => [node.name, node]));
  const chains: string[][] = [];
  for (const node of list) {
    if (node.name === name || !requiredNames.includes(node.name)) continue;
    if (!transitiveDependencies(list, node.name).includes(name)) continue;
    // 最短の道(幅優先)
    const prev = new Map<string, string>();
    const queue = [node.name];
    while (queue.length > 0 && !prev.has(name)) {
      const current = queue.shift()!;
      for (const dep of byName.get(current)?.dependsOn ?? []) {
        if (dep === node.name || prev.has(dep)) continue;
        prev.set(dep, current);
        queue.push(dep);
      }
    }
    const chain = [name];
    while (chain[0] !== node.name) chain.unshift(prev.get(chain[0])!);
    chains.push(chain);
  }
  return chains;
}

/** 入切の計画(純関数): Tier・規則の本文・switches.config.ts の本文・必須の理由(無ければ null)・依存の事実 */
export function planFeatureSetFromText(input: {
  name: string;
  tier1: boolean;
  /** 規則のファイル(repo 相対)と本文 */
  ruleFile: string;
  ruleText: string;
  /** switches.config.ts の本文(無ければ null) */
  switchesText: string | null;
  value: boolean;
  requiredReason: string | null;
  /** 必須の機能からこの機能までの依存の連鎖(requiredDependencyChains。無ければ空) */
  requiredChains?: string[][];
  /** 規則の値で閉の直の依存先(on のときに知らせる。無ければ空) */
  closedDependencies?: string[];
}): FeatureSetPlan {
  if (!input.value && input.requiredReason !== null) return { kind: "required", reason: input.requiredReason };
  if (!input.value && (input.requiredChains?.length ?? 0) > 0) return { kind: "requiredDependent", chains: input.requiredChains! };
  const closedDependencies = input.value ? [...(input.closedDependencies ?? [])] : [];
  if (input.tier1) {
    const after = rewriteRuleDefault(input.ruleText, input.value);
    if (after === null) return { kind: "unwritable", why: `${input.ruleFile} に export const rule = { … } が無いか、直下の defaultEnabled がリテラルの 1 つでない`, enabledSource: "defaultEnabled" };
    return { kind: "write", configFile: input.ruleFile, before: input.ruleText, after, changed: after !== input.ruleText, closedDependencies };
  }
  if (input.switchesText === null) return { kind: "unwritable", why: `${SWITCHES_FILE} が無い(上流が空で出荷する。取り込みを確かめる)`, enabledSource: "-" };
  const after = rewriteSwitch(input.switchesText, input.name, input.value);
  if (after === null) {
    return { kind: "unwritable", why: `${SWITCHES_FILE} の default export がオブジェクトのリテラルでないか、直下の ${input.name} がリテラルの 1 つでない`, enabledSource: "-" };
  }
  return { kind: "write", configFile: SWITCHES_FILE, before: input.switchesText, after, changed: after !== input.switchesText, closedDependencies };
}

const ruleFileOf = (root: string, name: string) =>
  [`src/featureGate/rules/${name}.ts`, `src/featureGate/rules/${name}/index.ts`].find((rel) => existsSync(join(root, rel))) ?? null;

/**
 * repo を読んで計画を立てる(pnpm ops features set の入口。書かない)。依存は規則の値の一覧(configRules、スイッチを通さない)で見る。
 * list・tier1 は差し替え用(テスト。tier1 の既定は readForkIdentity(root).isTier1)
 */
export function planFeatureSet(
  root: string,
  name: string,
  value: boolean,
  required: Readonly<Record<string, string>>,
  list: readonly GatedFeatureRule[] = configRules,
  tier1: boolean = readForkIdentity(root).isTier1,
): FeatureSetPlan {
  const ruleFile = ruleFileOf(root, name);
  if (!ruleFile) return { kind: "unwritable", why: `規則 src/featureGate/rules/${name}.ts が無い`, enabledSource: "-" };
  const self = list.find((rule) => rule.name === name);
  const closedDependencies = (self?.dependsOn ?? []).filter((dep) => {
    const rule = list.find((r) => r.name === dep);
    return rule !== undefined && !ruleEnabled(rule);
  });
  const switchesPath = join(root, SWITCHES_FILE);
  return planFeatureSetFromText({
    name,
    tier1,
    ruleFile,
    ruleText: readFileSync(join(root, ruleFile), "utf8"),
    switchesText: existsSync(switchesPath) ? readFileSync(switchesPath, "utf8") : null,
    value,
    requiredReason: required[name] ?? null,
    requiredChains: requiredDependencyChains(list, name, Object.keys(required)),
    closedDependencies,
  });
}

/** 計画が write なら書く */
export function applyFeatureSet(root: string, plan: FeatureSetPlan): void {
  if (plan.kind === "write" && plan.changed) writeFileSync(join(root, plan.configFile), plan.after);
}
