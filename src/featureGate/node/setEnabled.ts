// src/featureGate/node/setEnabled.ts(入口 @/featureGate/node の planFeatureSet・applyFeatureSet。pnpm ops features set が使う)
//
// 機能の入切を書き換える(L1.19)。書けるのは、規則の enabled が機能のドメインの config の `<X>_CONFIG.enabled` だけを読み
// (`enabled: () => X_CONFIG.enabled`、X_CONFIG は `@/features/<d>/config` からの import)、その config.ts の
// `export const X_CONFIG = { … enabled: true|false … }` にリテラルの enabled が 1 つだけあるとき(上書きを持たない持ち主)、または
// その config.ts が上書き `@/config/features/<名前>.config` を合成する持ち主のとき(closable のひな形・値の移動の後の形、目録 D19)。
// 上書きを持つ持ち主は上書きの default export の直下の enabled を書く(無ければ足す)。値はいつも true|false を書く(L1.26: 既定と同じでも消さない)。
// それ以外は書かずに、規則の enabled の字面(値を読む場所)を返す。必須(required/)の機能と、必須の機能が dependsOn で推移的に依存する機能を off にはしない(依存の連鎖を返す)。
// on にした機能の依存先が規則の値で閉なら、書いた上でその名前を返す(依存先が閉なので閉のまま。L3.1)。
// db:push・pnpm generate extensions は打たない(開けたら db:push が要ると案内する)。詳細: src/featureGate/README.md「pnpm ops features list / pnpm ops features set」

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { configRules, ruleEnabled, transitiveDependencies, type FeatureDependencyNode } from "../ruleList";
import type { GatedFeatureRule } from "../types";

export type FeatureSetPlan =
  /** closedDependencies = on にしたが規則の値で閉の直の依存先(書いても閉のまま)。off では空 */
  | { kind: "write"; configFile: string; before: string; after: string; changed: boolean; closedDependencies: string[] }
  | { kind: "required"; reason: string }
  /** chains = 必須の機能からこの機能までの依存の連鎖(各 [必須の機能, …, この機能]) */
  | { kind: "requiredDependent"; chains: string[][] }
  | { kind: "unwritable"; why: string; enabledSource: string };

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");

/** 規則の本文から、読む config(定数名とドメインのフォルダ)を読む。書けない形なら理由 */
export function readRuleConfigTarget(ruleText: string): { constName: string; folder: string } | { why: string; enabledSource: string } {
  const body = stripComments(ruleText);
  // enabled の値の字面(行末の , と閉じ括弧は除く)
  const enabledSource = /\benabled\s*:\s*([^\n]*)/.exec(body)?.[1]?.replace(/[\s,;}]+$/, "").trim() ?? "(enabled が読めない)";
  const enabled = /^\(\)\s*=>\s*([A-Z][A-Z0-9_]*)\.enabled$/.exec(enabledSource);
  if (!enabled) return { why: "規則の enabled が <X>_CONFIG.enabled の 1 つだけを読む形でない", enabledSource };
  const constName = enabled[1];
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${constName}\\b[^}]*\\}\\s*from\\s*["']@/features/((?:core/)?[^/"']+)/config["']`).exec(body);
  if (!imported) return { why: `${constName} が機能のドメインの config(@/features/<d>/config)から import されていない`, enabledSource };
  return { constName, folder: imported[1] };
}

/** config.ts の本文の <X>_CONFIG の enabled を書き換えた本文。書けない形なら null */
export function rewriteConfigEnabled(configText: string, constName: string, value: boolean): string | null {
  const start = configText.search(new RegExp(`export\\s+const\\s+${constName}\\b[^=]*=\\s*\\{`));
  if (start < 0) return null;
  const open = configText.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < configText.length; i += 1) {
    if (configText[i] === "{") depth += 1;
    else if (configText[i] === "}" && (depth -= 1) === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const block = configText.slice(open, end + 1);
  const hits = [...block.matchAll(/(^|[\s{,])enabled\s*:\s*(true|false)\b/g)];
  if (hits.length !== 1) return null;
  const replaced = block.replace(/(^|[\s{,])enabled\s*:\s*(true|false)\b/, (_m, lead) => `${lead}enabled: ${value}`);
  return configText.slice(0, open) + replaced + configText.slice(end + 1);
}

/** config.ts が合成する上書き(`import x from "@/config/features/<名前>.config"`)の repo 相対のパス。無ければ null */
export function readOverrideFile(configText: string): string | null {
  const match = /^\s*import\s+[A-Za-z_$][\w$]*\s*(?:,\s*\{[^}]*\})?\s*from\s*["']@\/config\/features\/([^"']+)\.config["']/m.exec(stripComments(configText));
  return match ? `src/config/features/${match[1]}.config.ts` : null;
}

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

/** 上書きの本文の default export の直下の enabled を value にした本文(無ければ先頭に足す)。default export がオブジェクトのリテラルでなければ null */
export function rewriteOverrideEnabled(overrideText: string, value: boolean): string | null {
  const head = /export\s+default\s*\{/.exec(overrideText);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  const scanned = scanObject(overrideText, open);
  if (!scanned) return null;
  const hits: Array<{ start: number; end: number }> = [];
  for (const [from, to] of scanned.topLevel) {
    const piece = overrideText.slice(from, to);
    for (const m of piece.matchAll(/(^|[\s{,])enabled\s*:\s*(true|false)\b/g)) {
      const start = from + m.index + m[1].length;
      hits.push({ start, end: from + m.index + m[0].length });
    }
  }
  if (hits.length > 1) return null;
  if (hits.length === 1) return overrideText.slice(0, hits[0].start) + `enabled: ${value}` + overrideText.slice(hits[0].end);
  const inner = overrideText.slice(open + 1, scanned.end);
  if (inner.trim() === "") return `${overrideText.slice(0, open)}{ enabled: ${value} }${overrideText.slice(scanned.end + 1)}`;
  const newline = /^[ \t]*\n([ \t]*)/.exec(inner);
  const insert = newline ? `\n${newline[1]}enabled: ${value},` : ` enabled: ${value},`;
  return overrideText.slice(0, open + 1) + insert + overrideText.slice(open + 1);
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

/** 入切の計画(純関数): 規則の本文・config の本文(無ければ null)・必須の理由(無ければ null)・依存の事実 */
export function planFeatureSetFromText(input: {
  ruleText: string;
  configFile: (folder: string) => string;
  readConfig: (file: string) => string | null;
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
  const target = readRuleConfigTarget(input.ruleText);
  if ("why" in target) return { kind: "unwritable", why: target.why, enabledSource: target.enabledSource };
  const configFile = input.configFile(target.folder);
  const before = input.readConfig(configFile);
  if (before === null) return { kind: "unwritable", why: `${configFile} が無い`, enabledSource: `${target.constName}.enabled` };
  // 上書きを合成する持ち主: 書き先は上書き(目録 D19・L1.26)
  const overrideFile = readOverrideFile(before);
  if (overrideFile !== null) {
    const overrideBefore = input.readConfig(overrideFile);
    if (overrideBefore === null) return { kind: "unwritable", why: `${overrideFile} が無い`, enabledSource: `${target.constName}.enabled` };
    const overrideAfter = rewriteOverrideEnabled(overrideBefore, input.value);
    if (overrideAfter === null) {
      return { kind: "unwritable", why: `${overrideFile} の default export がオブジェクトのリテラルでないか、直下の enabled: true|false が 2 つ以上ある`, enabledSource: `${target.constName}.enabled` };
    }
    return { kind: "write", configFile: overrideFile, before: overrideBefore, after: overrideAfter, changed: overrideBefore !== overrideAfter, closedDependencies };
  }
  const after = rewriteConfigEnabled(before, target.constName, input.value);
  if (after === null) {
    return { kind: "unwritable", why: `${configFile} の ${target.constName} にリテラルの enabled: true|false が 1 つだけ無い`, enabledSource: `${target.constName}.enabled` };
  }
  return { kind: "write", configFile, before, after, changed: before !== after, closedDependencies };
}

const ruleFileOf = (root: string, name: string) =>
  [join(root, "src/featureGate/rules", `${name}.ts`), join(root, "src/featureGate/rules", name, "index.ts")].find(existsSync) ?? null;

/**
 * repo を読んで計画を立てる(pnpm ops features set の入口。書かない)。依存は規則の値の一覧(configRules、スイッチを通さない)で見る
 * list は差し替え用(テスト)
 */
export function planFeatureSet(
  root: string,
  name: string,
  value: boolean,
  required: Readonly<Record<string, string>>,
  list: readonly GatedFeatureRule[] = configRules,
): FeatureSetPlan {
  const ruleFile = ruleFileOf(root, name);
  if (!ruleFile) return { kind: "unwritable", why: `規則 src/featureGate/rules/${name}.ts が無い`, enabledSource: "-" };
  const self = list.find((rule) => rule.name === name);
  const closedDependencies = (self?.dependsOn ?? []).filter((dep) => {
    const rule = list.find((r) => r.name === dep);
    return rule !== undefined && !ruleEnabled(rule);
  });
  return planFeatureSetFromText({
    requiredChains: requiredDependencyChains(list, name, Object.keys(required)),
    closedDependencies,
    ruleText: readFileSync(ruleFile, "utf8"),
    configFile: (folder) => `src/features/${folder}/config.ts`,
    readConfig: (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : null),
    value,
    requiredReason: required[name] ?? null,
  });
}

/** 計画が write なら書く */
export function applyFeatureSet(root: string, plan: FeatureSetPlan): void {
  if (plan.kind === "write" && plan.changed) writeFileSync(join(root, plan.configFile), plan.after);
}
