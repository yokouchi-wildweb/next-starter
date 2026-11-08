// src/lib/districtMap/read.mjs
// 地区の地図の読み手(目録 D1・D2・D12)。木を歩いて 4 種の地区を見つけ、各地区の欄を字面で読む。
// ファイルの読み方は注入する(source.listDir・source.readText)。node:fs で今の木を読む入口は ./node.mjs。
// 宣言は今の置き場が正本(domain.json・domainEntry・extensionPoints・門の規則・frame:・CATALOG.md)。この読み手は写しを持たない。
// 載せない物(目録 D8・D12): 値・access・関数・門の pathPatterns と enabled・受け口の項目の一覧・所有(どのリポの物か)。

import { readDeclaration } from "./declarations.mjs";
import { readDomainEntry, readFrameName, readRuleFeatures, readTableNames } from "./fields.mjs";
import {
  APP_ROOT,
  CONFIG_FILE,
  CORE_DIR_NAME,
  DISTRICT_KINDS,
  DOMAIN_ENTRY_FILE,
  FEATURES_ROOT,
  GATE_RULES_DIR,
  LAYOUT_DIR_NAME,
  LIB_ROOT,
  PROXIES_DIR,
  PROXIES_NAME,
  RECEPTACLE_FILE,
  SKIP_DIRS,
  overridePathOf,
} from "./kinds.mjs";

/**
 * @typedef {{ listDir: (rel: string) => { name: string, isDir: boolean }[], readText: (rel: string) => string | null }} DistrictSource
 *   listDir = フォルダの直下(無ければ [])、readText = ファイルの本文(無ければ null)。パスはリポジトリ直下からの相対(/ 区切り)
 * @typedef {{ path: string, exists: boolean }} FileSlot
 * @typedef {{
 *   kind: "features" | "lib" | "frame" | "proxies", name: string, core: boolean | null, dir: string,
 *   config: FileSlot, override: FileSlot, apiKeys: string[], tables: string[], requires: string[],
 *   gates: string[], receptacles: string[], frame: string | null,
 * }} District
 */

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\./;
const join = (...parts) => parts.filter((p) => p !== "").join("/");
const dirsOf = (source, rel) => source.listDir(rel).filter((e) => e.isDir && !e.name.startsWith("."));

/** 地区の中の全ファイル(SKIP_DIRS と隠しフォルダには入らない) */
function filesUnder(source, rel, out = []) {
  for (const entry of source.listDir(rel)) {
    if (entry.name.startsWith(".")) continue;
    const path = join(rel, entry.name);
    if (entry.isDir) {
      if (!SKIP_DIRS.includes(entry.name)) filesUnder(source, path, out);
    } else out.push(path);
  }
  return out;
}

/** 地区の見つけ方(種類ごと)。{ kind, name, core, dir, frame? } の一覧 */
function discover(source, problems) {
  const found = [];
  for (const entry of dirsOf(source, FEATURES_ROOT)) {
    if (entry.name.startsWith("_")) continue;
    if (entry.name === CORE_DIR_NAME) {
      for (const core of dirsOf(source, join(FEATURES_ROOT, CORE_DIR_NAME))) {
        if (!core.name.startsWith("_")) found.push({ kind: "features", name: core.name, core: true, dir: join(FEATURES_ROOT, CORE_DIR_NAME, core.name) });
      }
    } else found.push({ kind: "features", name: entry.name, core: false, dir: join(FEATURES_ROOT, entry.name) });
  }
  for (const entry of dirsOf(source, LIB_ROOT)) found.push({ kind: "lib", name: entry.name, core: null, dir: join(LIB_ROOT, entry.name) });
  const walkApp = (rel) => {
    for (const entry of dirsOf(source, rel)) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      const path = join(rel, entry.name);
      if (entry.name === LAYOUT_DIR_NAME) {
        const configPath = join(path, CONFIG_FILE);
        const text = source.readText(configPath);
        if (text !== null) {
          const read = readFrameName(configPath, text);
          problems.push(...read.problems);
          if (read.frame !== null) found.push({ kind: "frame", name: read.frame, core: null, dir: path });
          else if (read.problems.length === 0) problems.push(`${configPath}: 枠の config.ts に frame: "<枠の名前>" が無い(設定 D75)`);
        }
      }
      walkApp(path);
    }
  };
  walkApp(APP_ROOT);
  if (source.listDir(PROXIES_DIR).length > 0) found.push({ kind: "proxies", name: PROXIES_NAME, core: null, dir: PROXIES_DIR });
  return found;
}

/** 名前の一意(種類の中、目録 D3・D17)。直すのは後から足した側 */
function nameProblems(found) {
  const problems = [];
  for (const kind of DISTRICT_KINDS) {
    const byName = new Map();
    for (const d of found.filter((x) => x.kind === kind)) byName.set(d.name, [...(byName.get(d.name) ?? []), d]);
    for (const [name, same] of byName) {
      if (same.length < 2) continue;
      if (kind === "features") {
        const core = same.find((d) => d.core);
        const others = same.filter((d) => !d.core).map((d) => d.dir);
        problems.push(
          `features の地区の名前 ${name} が重なる: core の ${core?.dir ?? "-"} と業務の ${others.join("・")}。core は Tier1 が足した物なので、業務のドメイン(fork か中間の Tier が足した側)を改名する(目録 D3・D17)`,
        );
      } else if (kind === "frame") {
        problems.push(`枠の名前 ${name} が重なる: ${same.map((d) => `${d.dir}/${CONFIG_FILE}`).join("・")}。後から足した側の frame: を別の名前にする(目録 D17)`);
      } else problems.push(`${kind} の地区の名前 ${name} が重なる: ${same.map((d) => d.dir).join("・")}`);
    }
  }
  return problems;
}

/** 門の規則の features → 地区の dir ごとの規則の名前 */
function readGates(source, featuresByFolder, problems) {
  const gates = new Map();
  for (const entry of source.listDir(GATE_RULES_DIR)) {
    if (entry.isDir || !/\.ts$/.test(entry.name) || TEST_FILE.test(entry.name)) continue;
    const path = join(GATE_RULES_DIR, entry.name);
    const rule = entry.name.replace(/\.ts$/, "");
    const read = readRuleFeatures(path, source.readText(path) ?? "");
    problems.push(...read.problems);
    for (const folder of read.features) {
      const dir = featuresByFolder.get(folder.replace(/\/+$/, ""));
      if (!dir) problems.push(`${path}: features の ${folder} に当たる features の地区が無い`);
      else gates.set(dir, [...(gates.get(dir) ?? []), rule]);
    }
  }
  return gates;
}

/**
 * 地区の地図を読む
 * @param {DistrictSource} source
 * @returns {{ districts: District[], problems: string[], tableFiles: { name: string, file: string, dir: string }[], tableProblems: string[] }}
 *   districts の並び = 種類(DISTRICT_KINDS の順)→ 名前。tableFiles = features の地区の表と定義ファイル(パス順 → 出現順。schemaRegistry が定義ファイルを使う。jsonl には載せない)、tableProblems = 表名を字面で読めない問題だけ(problems にも入る)
 */
export function readDistrictMap(source) {
  const problems = [];
  const tableFiles = [];
  const tableProblems = [];
  const found = discover(source, problems);
  problems.push(...nameProblems(found));
  // 規則の features は src/features からの相対("core/<d>" か "<d>")
  const featuresByFolder = new Map(found.filter((d) => d.kind === "features").map((d) => [d.dir.slice(FEATURES_ROOT.length + 1), d.dir]));
  const gates = readGates(source, featuresByFolder, problems);
  const apiKeyOwners = new Map();

  const districts = found.map((d) => {
    const configPath = d.kind === "proxies" ? join(PROXIES_DIR, CONFIG_FILE) : join(d.dir, CONFIG_FILE);
    const overridePath = overridePathOf(d.kind, d.name);
    const files = filesUnder(source, d.dir);
    /** @type {District} */
    const district = {
      kind: d.kind,
      name: d.name,
      core: d.core,
      dir: d.dir,
      config: { path: configPath, exists: source.readText(configPath) !== null },
      override: { path: overridePath, exists: source.readText(overridePath) !== null },
      apiKeys: [],
      tables: [],
      requires: [],
      gates: [...new Set(gates.get(d.dir) ?? [])].sort(),
      receptacles: [],
      frame: d.kind === "frame" ? d.name : null,
    };
    if (d.kind === "features") {
      const entryPath = join(d.dir, DOMAIN_ENTRY_FILE);
      const entryText = source.readText(entryPath);
      if (entryText !== null) {
        const read = readDomainEntry(entryPath, entryText);
        problems.push(...read.problems);
        district.apiKeys = read.keys;
        district.requires = read.requires;
        for (const key of read.keys) apiKeyOwners.set(key, [...(apiKeyOwners.get(key) ?? []), d.dir]);
      }
      for (const path of files.filter((f) => SOURCE_FILE.test(f) && !TEST_FILE.test(f)).sort()) {
        const read = readTableNames(path, source.readText(path) ?? "");
        problems.push(...read.problems);
        tableProblems.push(...read.problems);
        district.tables.push(...read.tables);
        for (const name of read.tables) tableFiles.push({ name, file: path, dir: d.dir });
      }
    }
    // 受け口: 地区の中の extensionPoints.ts の点の名前(宣言の誤りは pnpm check extensions が出すので、ここでは読めた点だけ)
    for (const path of files.filter((f) => f.endsWith(`/${RECEPTACLE_FILE}`)).sort()) {
      district.receptacles.push(...Object.keys(readDeclaration(path, source.readText(path) ?? "").points));
    }
    district.receptacles.sort();
    return district;
  });

  // domainEntry のキーは全 tier で一意(汎用 API・表の資源の名前、目録 D4)
  for (const [key, dirs] of apiKeyOwners) {
    if (dirs.length > 1) problems.push(`domainEntry のキー ${key} が ${dirs.join("・")} で重なる(汎用 API の名前は一意。後から足した側のキーを変える)`);
  }
  const order = (d) => DISTRICT_KINDS.indexOf(d.kind);
  districts.sort((a, b) => order(a) - order(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  tableFiles.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return { districts, problems, tableFiles, tableProblems };
}

/**
 * district-map.jsonl の本文(1 行 1 地区、末尾に改行)
 * @param {District[]} districts
 */
export const toJsonl = (districts) => districts.map((d) => JSON.stringify(d)).join("\n") + (districts.length > 0 ? "\n" : "");
