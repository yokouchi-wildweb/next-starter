// src/featureGate/checks/featureRequirements.ts
// 機能を要する設定の値の検査(設定 D107・D110、門番 m107 の 1 検査 1 ファイル)。
// 地区の持ち主の config.ts の宣言 featureRequirements(読み手 src/lib/districtMap、地図の欄)ごとに、合成した値(既定 + src/config の上書き)を
// 鍵で読み、off でない(element なら要素に off 以外がある)のに機能が規則の値で閉(configEnabled、全開スイッチを通さない)なら失敗にする。
// 入口: 門 build の pnpm check proxies(scripts/structure/proxies/check.ts)と FEATURE_GATE_CHECK=all pnpm test src/featureGate(./featureRequirements.test.ts)

import path from "node:path";
import { pathToFileURL } from "node:url";

import { readDistrictMapAt } from "../../lib/districtMap/node.mjs";
import { configEnabled, configRules } from "../ruleList";
import type { FeatureName } from "../types";

export type DeclaredRequirement = { key: string; feature: string; off: unknown; element?: true };

/** 1 つの地区の宣言と合成した値 */
export type RequirementSubject = {
  district: string;
  configPath: string;
  overridePath: string;
  requirements: DeclaredRequirement[];
  /** 合成した設定(読めなかったら null と理由) */
  composed: Record<string, unknown> | null;
  loadProblem?: string;
};

/** 点区切りの鍵で値を読む(無ければ undefined) */
export function valueAt(composed: Record<string, unknown>, key: string): unknown {
  let current: unknown = composed;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 値が機能を要するか(off と違う。element なら配列の要素に off と違う物がある) */
export function requiresFeature(value: unknown, requirement: DeclaredRequirement): boolean {
  if (requirement.element) return Array.isArray(value) && value.some((item) => item !== requirement.off);
  return value !== requirement.off;
}

/**
 * 守られていない宣言の一覧(文)。isOpen = 機能が規則の値で開いているか、known = 機能の名前か
 */
export function unmetRequirements(
  subjects: RequirementSubject[],
  isOpen: (feature: string) => boolean,
  known: (feature: string) => boolean,
): string[] {
  const problems: string[] = [];
  for (const subject of subjects) {
    if (subject.requirements.length === 0) continue;
    if (subject.composed === null) {
      problems.push(`${subject.district}: ${subject.configPath} の合成した設定を読めない(${subject.loadProblem ?? "defineConfig の定義が見つからない"})`);
      continue;
    }
    for (const requirement of subject.requirements) {
      const where = `${subject.district} の ${requirement.key}`;
      if (!known(requirement.feature)) {
        problems.push(`${where}: 宣言の機能 ${requirement.feature} が門番の規則に無い(${subject.configPath} の featureRequirements を直す)`);
        continue;
      }
      const value = valueAt(subject.composed, requirement.key);
      if (value === undefined) {
        problems.push(`${where}: 合成した設定に鍵が無い(${subject.configPath} の featureRequirements の key を直す)`);
        continue;
      }
      if (!requiresFeature(value, requirement) || isOpen(requirement.feature)) continue;
      problems.push(
        `${where} = ${JSON.stringify(value)} は機能 ${requirement.feature} を要するが、その機能が閉じている。直し方は 2 つ: ` +
          `(1) 機能を開ける: pnpm ops features set ${requirement.feature} on ` +
          `(2) 使わない値にする: ${subject.overridePath} に ${requirement.key} = ${JSON.stringify(requirement.off)}${requirement.element ? " だけの配列(か off 以外の要素を外す)" : ""} を書く`,
      );
    }
  }
  return problems;
}

type ConfigDef = { compose: (override: unknown) => Record<string, unknown> };
const isDef = (value: unknown): value is ConfigDef =>
  typeof value === "object" && value !== null && typeof (value as { compose?: unknown }).compose === "function";

/** 地区の config.ts の defineConfig の定義に上書きを合成する(宣言のある地区だけ) */
async function compose(repoRoot: string, configPath: string, overridePath: string, overrideExists: boolean) {
  try {
    const owner = (await import(pathToFileURL(path.join(repoRoot, configPath)).href)) as Record<string, unknown>;
    const defs = Object.values(owner).filter(isDef);
    if (defs.length !== 1) return { composed: null, loadProblem: `defineConfig の定義が ${defs.length} つ(1 つにする)` };
    const override = overrideExists ? ((await import(pathToFileURL(path.join(repoRoot, overridePath)).href)) as { default?: unknown }).default ?? {} : {};
    return { composed: defs[0].compose(override) };
  } catch (error) {
    return { composed: null, loadProblem: error instanceof Error ? error.message : String(error) };
  }
}

/** 今の木の検査。地図の問題(宣言が字面で読めない)と、守られていない宣言を返す */
export async function checkFeatureRequirements(repoRoot: string): Promise<{ problems: string[]; checked: number }> {
  const map = readDistrictMapAt(repoRoot);
  const problems = map.problems.filter((p: string) => p.includes("featureRequirements"));
  const subjects: RequirementSubject[] = [];
  for (const district of map.districts) {
    if (district.featureRequirements.length === 0) continue;
    const loaded = await compose(repoRoot, district.config.path, district.override.path, district.override.exists);
    subjects.push({
      district: `${district.kind}/${district.name}`,
      configPath: district.config.path,
      overridePath: district.override.path,
      requirements: district.featureRequirements as DeclaredRequirement[],
      ...loaded,
    });
  }
  const names = new Set(configRules.map((rule) => rule.name as string));
  problems.push(...unmetRequirements(subjects, (feature) => configEnabled(feature as FeatureName), (feature) => names.has(feature)));
  return { problems, checked: subjects.reduce((sum, s) => sum + s.requirements.length, 0) };
}
