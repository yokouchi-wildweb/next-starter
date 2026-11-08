// src/featureGate/checks/dependencies.mjs
// 依存の検査の判定(D20(b)・L1.12)。閉じられるフォルダ(規則の features)を、そのフォルダの外から値で import するファイルを集め、
// 次の形のどれでもなければ違反として返す:
//   (1) import する側のドメインの domainEntry.ts の requires に相手のドメインの名前(フォルダ名、目録 D4)がある
//       (ドメインの見つけ方・requires・名前は地区の地図の読み手 src/lib/districtMap から)
//   (2) ファイルが規則の名前で gate.enabled / gate.assert / useGate().enabled を呼ぶ(`.enabled("R")`・`.assert("R")` の字面)
//   (3) ファイルが src/app の下で、その規則の pathPatterns が覆う住所にある(page・loader・route・_screen・_components…)
//   (4) 同じ規則のフォルダどうし
//   (5) fork の required/<規則名>.ts(x) がある
//   (6) 例外(上流 = 検査の中の表、fork = 受け口 dependencyExceptions/)に載る
// 数えない: src/registry(生成の一覧)・src/featureGate・テスト(*.test.*)。import は型だけの物を除く(動的 import は数える)
// 限界: 字面だけを見る。別のモジュールを経由した到達・(2) の呼び出しが import の使い所を本当に守っているかは見ない

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { readDistrictMapAt } from "../../lib/districtMap/node.mjs";
import { patternCoversRoute } from "../../lib/pathPattern/index.mjs";
import { valueImportSources } from "./importSources.mjs";

const toPosix = (p) => p.split(sep).join("/");
const SOURCE = /\.(ts|tsx|mts|mjs)$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules") walk(path, out);
    } else if (SOURCE.test(name) && !TEST.test(name)) out.push(path);
  }
  return out;
}

/**
 * ファイル → 属する features の地区(src/features からの相対のフォルダ "core/<d>" か "<d>" と、地区の名前・requires)
 * @param {import("../../lib/districtMap/read.mjs").District[]} districts
 */
function domainLookup(districts) {
  const domains = districts
    .filter((d) => d.kind === "features")
    .map((d) => ({ folder: d.dir.slice("src/features/".length), prefix: `${d.dir}/`, name: d.name, requires: d.requires }));
  const byFolder = new Map(domains.map((d) => [d.folder, d]));
  return {
    /** src/features の下のファイルが属するドメイン。地区の外なら null */
    of: (rel) => domains.find((d) => rel.startsWith(d.prefix)) ?? null,
    /** 規則の features のフォルダが名乗る名前(地区の名前 = フォルダ名だけ。domainEntry のキーは資源の名前で名乗りに使わない、目録 D4) */
    nameOf: (folder) => byFolder.get(folder)?.name ?? folder.split("/").pop(),
  };
}

/** src/app の下のファイルの住所のセグメント(ルートグループ・_ で始まるフォルダ・ファイル名を除く)。外なら null */
export function routeSegmentsOf(rel) {
  const m = /^src\/app\/(.*)$/.exec(rel);
  if (!m) return null;
  const parts = m[1].split("/");
  parts.pop();
  return parts.filter((seg) => !/^\(.*\)$/.test(seg) && !seg.startsWith("_") && !seg.startsWith("@"));
}

/** fork の required/ の機能名(ファイル名) */
export function readRequiredNames(root) {
  const dir = join(root, "src/featureGate/required");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name !== "README.md")
    .map((name) => name.replace(/\.(ts|tsx)$/, ""));
}

const callsGate = (text, ruleName) =>
  new RegExp(`\\.(enabled|assert)\\(\\s*["'\`]${ruleName}["'\`]\\s*\\)`).test(text);

/**
 * 閉じられるフォルダを外から値で読むファイルを全部集め、どの形で許されたかを付ける(許されなければ allowedBy: null = 違反)。
 * pnpm ops features list(node/describe.ts)の依存の一覧と、違反の判定 findDependencyViolations が共有する
 * @param {{ root: string, rules: { name: string, features?: string[], pathPatterns: string[] }[], exceptionFiles?: string[], requiredNames?: string[] }} input
 * @returns {{ file: string, folder: string, rule: string, allowedBy: "sameRule" | "requires" | "gate" | "route" | "required" | "exception" | null }[]}
 */
export function scanDependencies({ root, rules, exceptionFiles = [], requiredNames = readRequiredNames(root) }) {
  const folderRules = new Map();
  for (const rule of rules) for (const folder of rule.features ?? []) folderRules.set(folder, [...(folderRules.get(folder) ?? []), rule]);
  const folders = [...folderRules.keys()];
  const folderOfTarget = (resolved) => folders.find((f) => resolved === `src/features/${f}` || resolved.startsWith(`src/features/${f}/`)) ?? null;
  const domains = domainLookup(readDistrictMapAt(root).districts);
  const exceptions = new Set(exceptionFiles);
  const found = [];
  const seen = new Set();

  for (const path of walk(join(root, "src"))) {
    const rel = toPosix(relative(root, path));
    if (rel.startsWith("src/registry/") || rel.startsWith("src/featureGate/")) continue;
    const text = readFileSync(path, "utf8");
    const ownDomain = domains.of(rel);
    const ownFolder = ownDomain?.folder ?? null;
    const ownRules = ownFolder ? (folderRules.get(folders.find((f) => ownFolder === f) ?? "") ?? []) : [];
    const segments = routeSegmentsOf(rel);
    for (const source of valueImportSources(text)) {
      const resolved = resolveImport(source, path, root);
      if (!resolved) continue;
      const folder = folderOfTarget(resolved);
      if (!folder) continue;
      if (ownFolder === folder) continue;
      for (const rule of folderRules.get(folder)) {
        const key = `${rel}|${folder}|${rule.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ file: rel, folder, rule: rule.name, allowedBy: allowedBy() });
        function allowedBy() {
          // (6) 例外
          if (exceptions.has(rel)) return "exception";
          // (4) 同じ規則のフォルダどうし
          if (ownRules.some((r) => r.name === rule.name)) return "sameRule";
          // (1) requires
          if (ownDomain && ownDomain.requires.includes(domains.nameOf(folder))) return "requires";
          // (2) 規則の名前で確かめる
          if (callsGate(text, rule.name)) return "gate";
          // (3) その規則で閉じる住所の下
          if (segments && rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, segments))) return "route";
          // (5) fork の required/
          if (requiredNames.includes(rule.name)) return "required";
          return null;
        }
      }
    }
  }
  return found;
}

/**
 * 違反を集める(scanDependencies の許されなかった物)
 * @param {{ root: string, rules: { name: string, features?: string[], pathPatterns: string[] }[], exceptionFiles?: string[], requiredNames?: string[] }} input
 * @returns {{ file: string, folder: string, rule: string }[]}
 */
export function findDependencyViolations(input) {
  return scanDependencies(input)
    .filter((entry) => entry.allowedBy === null)
    .map(({ file, folder, rule }) => ({ file, folder, rule }));
}
