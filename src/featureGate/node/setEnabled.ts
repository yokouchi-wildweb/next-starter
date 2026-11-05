// src/featureGate/node/setEnabled.ts(入口 @/featureGate/node の planFeatureSet・applyFeatureSet。pnpm features:set が使う)
//
// 機能の入切を書き換える(L1.19)。書けるのは、規則の enabled が機能のドメインの config の `<X>_CONFIG.enabled` だけを読み
// (`enabled: () => X_CONFIG.enabled`、X_CONFIG は `@/features/<d>/config` からの import)、その config.ts の
// `export const X_CONFIG = { … enabled: true|false … }` にリテラルの enabled が 1 つだけあるときだけ(closable のひな形・値の移動の後の形)。
// それ以外は書かずに、規則の enabled の字面(値を読む場所)を返す。必須(required/)の機能を off にはしない。
// db:push・extensions:generate は打たない(開けたら db:push が要ると案内する)。詳細: src/featureGate/README.md「features:list / features:set」

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type FeatureSetPlan =
  | { kind: "write"; configFile: string; before: string; after: string; changed: boolean }
  | { kind: "required"; reason: string }
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

/** 入切の計画(純関数): 規則の本文・config の本文(無ければ null)・必須の理由(無ければ null) */
export function planFeatureSetFromText(input: {
  ruleText: string;
  configFile: (folder: string) => string;
  readConfig: (file: string) => string | null;
  value: boolean;
  requiredReason: string | null;
}): FeatureSetPlan {
  if (!input.value && input.requiredReason !== null) return { kind: "required", reason: input.requiredReason };
  const target = readRuleConfigTarget(input.ruleText);
  if ("why" in target) return { kind: "unwritable", why: target.why, enabledSource: target.enabledSource };
  const configFile = input.configFile(target.folder);
  const before = input.readConfig(configFile);
  if (before === null) return { kind: "unwritable", why: `${configFile} が無い`, enabledSource: `${target.constName}.enabled` };
  const after = rewriteConfigEnabled(before, target.constName, input.value);
  if (after === null) {
    return { kind: "unwritable", why: `${configFile} の ${target.constName} にリテラルの enabled: true|false が 1 つだけ無い`, enabledSource: `${target.constName}.enabled` };
  }
  return { kind: "write", configFile, before, after, changed: before !== after };
}

const ruleFileOf = (root: string, name: string) =>
  [join(root, "src/featureGate/rules", `${name}.ts`), join(root, "src/featureGate/rules", name, "index.ts")].find(existsSync) ?? null;

/** repo を読んで計画を立てる(features:set の入口。書かない) */
export function planFeatureSet(root: string, name: string, value: boolean, required: Readonly<Record<string, string>>): FeatureSetPlan {
  const ruleFile = ruleFileOf(root, name);
  if (!ruleFile) return { kind: "unwritable", why: `規則 src/featureGate/rules/${name}.ts が無い`, enabledSource: "-" };
  return planFeatureSetFromText({
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
