// scripts/workflow/rules/lib.ruleGenerated.mjs
// 生成物の検査の部品(純粋な関数): 生成器の出力の宣言(各 gate.json の outputs)を、追跡中のファイルに当てる。
// 決まり: 生成物は直さず生成元を直す。見分け = 注釈を持てる形式は先頭の生成物の印、持てない JSON・JSONL は生成器の一覧(D135)。
import { matchesGlob } from "node:path";
import { isDomainTemplateGlob, normalizeGateOutputs } from "../../../src/lib/districtMap/domainOutputs.mjs";

// 注釈を持てる形式(先頭に印を書ける物)
export const MARKABLE = /\.(ts|tsx|mts|mjs|js|css)$/;
// 生成物の印: 先頭 MARK_LINES 行に、この語のどれか
export const MARK_LINES = 5;
export const MARK_PATTERN = /AUTO-GENERATED|DO NOT EDIT|自動生成|\bgenerated\b|生成物/i;

export const hasGeneratedMark = (text) => MARK_PATTERN.test(text.split("\n").slice(0, MARK_LINES).join("\n"));

/**
 * ドメインの雛形の glob をドメインのフォルダに当てた glob の並び({dir} = 各ドメイン、ほかの置き換え = *)
 * @param {string} glob
 * @param {string[]} domainDirs 作り直しの対象のドメインのフォルダ(generate:false を除く)
 */
export function expandDomainGlob(glob, domainDirs) {
  if (!isDomainTemplateGlob(glob)) return [glob];
  const rest = glob.replace(/\{(camel|Pascal|route)\}/g, "*");
  return rest.includes("{dir}") ? domainDirs.map((d) => rest.replace("{dir}", d)) : [rest];
}

/**
 * 生成器の出力の宣言 → 追跡中のファイル
 * @param {{ gate: string, outputs: unknown }[]} gates gate.json ごとの outputs
 * @param {string[]} files 追跡中のファイル
 * @param {string[]} domainDirs
 * @returns {{ gate: string, glob: string, kind: string, domain: boolean, files: string[], problems: string[] }[]}
 */
export function outputFiles(gates, files, domainDirs) {
  const out = [];
  for (const { gate, outputs } of gates) {
    const { entries, problems } = normalizeGateOutputs(outputs);
    if (problems.length) out.push({ gate, glob: "-", kind: "-", domain: false, files: [], problems });
    for (const e of entries) {
      const globs = expandDomainGlob(e.glob, domainDirs);
      out.push({ gate, glob: e.glob, kind: e.kind, domain: isDomainTemplateGlob(e.glob), files: files.filter((f) => globs.some((g) => matchesGlob(f, g))), problems: [] });
    }
  }
  return out;
}

/** 宣言の glob(ドメインの置き換えは代表の形)が generated の paths のどれかに当たらない物 */
export function outputsOutsidePaths(entries, generatedPaths) {
  const rep = (glob) => glob.replace(/\{dir\}/g, "src/features/x").replace(/\{[A-Za-z]+\}/g, "X").replace(/\*\*/g, "x").replace(/\*/g, "x");
  return entries.filter((e) => e.glob !== "-" && !generatedPaths.some((p) => matchesGlob(rep(e.glob), p) || matchesGlob(e.glob, p)));
}
