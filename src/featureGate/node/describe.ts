// src/featureGate/node/describe.ts(入口 @/featureGate/node の describeFeatures・readFeatureReport。pnpm ops features list が使う)
//
// 規則ごとの説明: 開閉・住所(手書き / 汎用 API の導出 / 設定の節の導出)・表・機能のフォルダ・
// 依存(閉じられるフォルダを外から値で読むファイルと、許された形。依存の検査 checks/dependencies.mjs の走査そのもの)・
// 名前の呼び出し箇所(gate.enabled / gate.assert / useGate().enabled の字面の "<名前>")・必須(required/<名前>.ts の reason)。
// 限界: 呼び出し箇所は字面の "<名前>" だけ(変数で渡す名前は見えない)。詳細: src/featureGate/README.md「pnpm ops features list / pnpm ops features set」

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { readRequiredNames, scanDependencies } from "../checks/dependencies.mjs";
import { configEnabled, isOpenedBySwitch, ruleEnabled } from "../ruleList";
import type { GatedFeatureRule } from "../types";

export type DependencyAllowedBy = "sameRule" | "requires" | "gate" | "route" | "required" | "exception" | null;
export type FeatureDependent = { file: string; folder: string; allowedBy: DependencyAllowedBy };

export type FeatureDescription = {
  name: string;
  /** 今の開閉(全開スイッチを通した値。門番の口と同じ答え) */
  enabled: boolean;
  /** 規則の値(config。スイッチを通さない) */
  configEnabled: boolean;
  /** 全開スイッチ FEATURE_GATE_OPEN で開いているか */
  openedBySwitch: boolean;
  /** 必須(required/<名前>.ts)なら reason、でなければ null */
  required: string | null;
  paths: { handWritten: string[]; domainApi: string[]; setting: string[]; cron: string[] };
  tables: string[];
  folders: string[];
  dependents: FeatureDependent[];
  callSites: string[];
};

export type FeatureFacts = {
  dependencies: { file: string; folder: string; rule: string; allowedBy: DependencyAllowedBy }[];
  /** 規則名 → 名前を字面で呼ぶファイル */
  callSites: Record<string, string[]>;
  /** 規則名 → 必須の理由 */
  required: Record<string, string>;
  /** 規則名 → 規則の値と全開スイッチ(無い規則は enabled の値・スイッチなしとみなす) */
  switchState?: Record<string, { configEnabled: boolean; openedBySwitch: boolean }>;
};

/** 規則と集めた事実から説明を組む(純関数。並びは一覧の順) */
export function describeFeatures(rules: readonly GatedFeatureRule[], facts: FeatureFacts): FeatureDescription[] {
  return rules.map((rule) => {
    const derived = rule.domainApiPaths.length + rule.settingPaths.length + rule.cronPaths.length;
    const enabled = ruleEnabled(rule);
    const state = facts.switchState?.[rule.name];
    return {
      name: rule.name,
      enabled,
      configEnabled: state?.configEnabled ?? enabled,
      openedBySwitch: state?.openedBySwitch ?? false,
      required: facts.required[rule.name] ?? null,
      paths: {
        handWritten: rule.pathPatterns.slice(0, rule.pathPatterns.length - derived),
        domainApi: [...rule.domainApiPaths],
        setting: [...rule.settingPaths],
        cron: [...rule.cronPaths],
      },
      tables: [...rule.tables],
      folders: [...(rule.features ?? [])],
      dependents: facts.dependencies
        .filter((d) => d.rule === rule.name)
        .map(({ file, folder, allowedBy }) => ({ file, folder, allowedBy })),
      callSites: [...(facts.callSites[rule.name] ?? [])],
    };
  });
}

const SOURCE = /\.(ts|tsx|mts|mjs)$/;
const CALL = /\.(?:enabled|assert)\(\s*["'`]([A-Za-z0-9]+)["'`]\s*\)/g;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules") walk(path, out);
    } else if (SOURCE.test(name)) out.push(path);
  }
  return out;
}

/** 名前を字面で呼ぶファイル(src と scripts。門番の中とテストは除く) */
export function findCallSites(root: string, names: readonly string[]): Record<string, string[]> {
  const known = new Set(names);
  const result: Record<string, string[]> = {};
  for (const path of [...walk(join(root, "src")), ...walk(join(root, "scripts"))]) {
    const rel = relative(root, path).split(sep).join("/");
    if (rel.startsWith("src/featureGate/") || /\.test\.[cm]?[jt]sx?$/.test(rel)) continue;
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(CALL)) {
      if (!known.has(match[1])) continue;
      const list = (result[match[1]] ??= []);
      if (!list.includes(rel)) list.push(rel);
    }
  }
  return result;
}

/** 必須の機能(required/<名前>.ts の export const required の reason) */
export async function readRequired(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of readRequiredNames(root) as string[]) {
    const file = ["ts", "tsx"].map((ext) => join(root, "src/featureGate/required", `${name}.${ext}`)).find(existsSync);
    const index = ["ts", "tsx"].map((ext) => join(root, "src/featureGate/required", name, `index.${ext}`)).find(existsSync);
    const target = file ?? index;
    if (!target) continue;
    const mod = (await import(pathToFileURL(target).href)) as { required?: { reason?: string } };
    result[name] = mod.required?.reason ?? "";
  }
  return result;
}

/** repo を読んで説明を作る(pnpm ops features list の入口) */
export async function readFeatureReport(
  root: string,
  rules: readonly GatedFeatureRule[],
  exceptionFiles: readonly string[] = [],
): Promise<FeatureDescription[]> {
  const required = await readRequired(root);
  const dependencies = scanDependencies({
    root,
    rules: [...rules],
    exceptionFiles: [...exceptionFiles],
    requiredNames: Object.keys(required),
  });
  const callSites = findCallSites(root, rules.map((rule) => rule.name));
  const switchState = Object.fromEntries(
    rules.map((rule) => [rule.name, { configEnabled: configEnabled(rule.name), openedBySwitch: isOpenedBySwitch(rule.name) }]),
  );
  return describeFeatures(rules, { dependencies, callSites, required, switchState });
}
