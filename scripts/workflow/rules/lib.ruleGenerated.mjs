// scripts/workflow/rules/lib.ruleGenerated.mjs
// 生成物の検査の部品(純粋な関数): 生成器の出力の宣言(各 gate.json の outputs)を、追跡中のファイルに当てる。
// 決まり: 生成物は直さず生成元を直す。見分け = 注釈を持てる形式は先頭の生成物の印、持てない JSON・JSONL は生成器の一覧(D135)。
import { matchesLoad } from "./lib.rulePaths.mjs";
import { domainNamesOf, isDomainTemplateGlob, normalizeGateOutputs } from "../../../src/lib/districtMap/node.mjs";

// 注釈を持てる形式(先頭に印を書ける物)
export const MARKABLE = /\.(ts|tsx|mts|mjs|js|css)$/;
// 生成物の印: 先頭 MARK_LINES 行に、この語のどれか
export const MARK_LINES = 5;
export const MARK_PATTERN = /AUTO-GENERATED|DO NOT EDIT|自動生成|\bgenerated\b|生成物/i;

export const hasGeneratedMark = (text) => MARK_PATTERN.test(text.split("\n").slice(0, MARK_LINES).join("\n"));

/**
 * ドメインの雛形の glob を、作り直しの対象のドメインごとの名({dir}・{camel}・{Pascal}・{route})で埋めた glob の並び
 * (src/lib/districtMap/domainOutputs.mjs の domainNamesOf と同じ名。[ ] は文字として照らす)
 * @param {string} glob
 * @param {{ dir: string, plural?: string }[]} domains 作り直しの対象のドメイン(generate:false を除く)
 */
export function expandDomainGlob(glob, domains) {
  if (!isDomainTemplateGlob(glob)) return [glob];
  return domains.map((d) => {
    const names = domainNamesOf(d);
    return glob.replace(/\{(dir|camel|Pascal|route)\}/g, (_, k) => names[k]).replace(/[[\]]/g, (ch) => `[${ch}]`);
  });
}

/**
 * 生成器の出力の宣言 → 追跡中のファイル
 * @param {{ gate: string, outputs: unknown }[]} gates gate.json ごとの outputs
 * @param {string[]} files 追跡中のファイル
 * @param {{ dir: string, plural?: string }[]} domains
 * @returns {{ gate: string, glob: string, kind: string, domain: boolean, files: string[], problems: string[] }[]}
 */
export function outputFiles(gates, files, domains) {
  const out = [];
  for (const { gate, outputs } of gates) {
    const { entries, problems } = normalizeGateOutputs(outputs);
    if (problems.length) out.push({ gate, glob: "-", kind: "-", domain: false, files: [], problems });
    for (const e of entries) {
      const globs = expandDomainGlob(e.glob, domains);
      out.push({ gate, glob: e.glob, kind: e.kind, domain: isDomainTemplateGlob(e.glob), files: files.filter((f) => globs.some((g) => matchesLoad(f, g))), problems: [] });
    }
  }
  return out;
}

/** 宣言の glob(ドメインの置き換えは代表の形)が generated の paths のどれかに当たらない物 */
export function outputsOutsidePaths(entries, generatedPaths) {
  const rep = (glob) => glob.replace(/\{dir\}/g, "src/features/x").replace(/\{[A-Za-z]+\}/g, "X").replace(/\*\*/g, "x").replace(/\*/g, "x");
  return entries.filter((e) => e.glob !== "-" && !generatedPaths.some((p) => matchesLoad(rep(e.glob), p) || matchesLoad(e.glob, p)));
}
