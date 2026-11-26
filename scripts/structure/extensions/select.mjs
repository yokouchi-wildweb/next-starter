// scripts/structure/extensions/select.mjs
// 選ぶ点(extensionPoints.ts の点に select を足した plugs の点、D9・D36)の生成と検査(pnpm generate extensions / pnpm check extensions の一部)。
// - 項目 <持ち主>/plugs/<点>/<名前>.ts の export const declaration を構文木で読む(実行しない、読み手 src/lib/districtMap/declarations.mjs)
// - 根の backend-selection.json({ <口>: <実装の名前> })が指す 1 項目の adapter だけを <持ち主>/extensions/<点>.ts に静的に re-export する
//   ("none" = 組み込みの none の adapter、@/lib/backends の createNoneAdapter)
// - 食い違いで止める(D14 fail-closed): 選択表の鍵の欠け・余り・知らない値・"fake"・任意でない口の "none"・口のどれかの点に項目が無い・
//   requires ↔ provides の不足・開いているドメインの backendRequirements の不足・項目の宣言の形・知らない語・語の再定義・
//   選んだ実装の requiresFeatures の機能が閉・知らない名前・開閉が読めない(直し方 = 機能を開くか別の実装を選ぶ)
// - 段 build・ship(env PHASE)では env の今の設定(compat が from "env")が選択と食い違えば止め、段 build では選んだ実装の env.required の
//   欠けを止めずに 1 行知らせる(D14。env の値は出さない)
// - 点 startupTasks が在れば、選ぶ点ごとに起動時の知らせの 1 行を一覧 src/wiring/startup.ts に足す(項目のファイルは作らない、D49):
//   load = @/lib/backends の createBackendStatusTask と持ち主の公開の入口の <点>BackendStatus({ port, selected, isConfigured })を
//   名前つきの dynamic import で読み、createBackendStatusTask(<点>BackendStatus)。送れる adapter は出さない。入口に無ければ止める
//   読みは process.env.NEXT_RUNTIME === "nodejs" の中だけ(Next の instrumentation の決まった形): 一覧は edge の束にも入るので、
//   条件の外で読むと持ち主の入口(mail なら webhook の node:crypto)が edge に入り Edge Runtime の警告になる(注文 20261125-195321)。
//   edge では同じ名前の nodejs の項目を返す(走らない: lib/startup が runtime で外す)
// - 選ぶ点が 0 個なら選択表を読まず、何も書かず、止めない
// 書式: ./README.md「選ぶ点」

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { readLibPackage } from "../../../src/lib/libPackage/node.mjs";

import { OFFLINE_ENV } from "../../runner/phases/offlineEnv.mjs";

import {
  BACKEND_ADAPTER_NAME,
  EXTENSIONS_DIR_NAME,
  SEARCH_ROOT,
  exportedInitializer,
  isSelectPoint,
  literalOf,
  readBackendDeclaration,
} from "../../../src/lib/districtMap/index.mjs";

/** 選択表(根の固有型 5 self のファイル) */
export const SELECTION_FILE = "backend-selection.json";
/** 予約の実装の名前の正(src/lib/backends、字面で読む) */
export const RESERVED_FILE = "src/lib/backends/reserved.ts";
/** 能力の語の増設点(src/lib/backends が持ち主、D19) */
export const CAPABILITIES_POINT = "backendCapabilities";
const CAPABILITIES_OWNER = "src/lib/backends";
const CAPABILITIES_EXPORT = "capabilities";
/** 直し方の命令(scripts/workflow/backend-selection) */
const FILL = "pnpm workflow backend-selection fill";
const SET = "pnpm workflow backend-selection set <口> <名前>";
/** env の食い違いを止める段(check extensions が乗る段のうち配る木を確かめる 2 つ) */
const ENV_GUARD_PHASES = ["build", "ship"];
/** env の欠けを知らせる段(本番の build。ship の手元の shell の env は配る先の env でない) */
const ENV_NOTICE_PHASES = ["build"];
/** offline の段(build・build:post): OFFLINE_ENV の名前は runner が外すので見えない */
const OFFLINE_PHASES = ["build", "build:post"];
/** 起動時の知らせの行を足す点(src/lib/startup) */
export const STATUS_POINT = "startupTasks";
/** 持ち主の公開の入口が出す口の状態の名前: <点>BackendStatus(D49) */
export const STATUS_EXPORT_SUFFIX = "BackendStatus";
const DOMAINS_ROOT = `${SEARCH_ROOT}/domains/`;
const WORD = /^[a-z][A-Za-z0-9]*$/;

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/**
 * 生成物から読む先: 持ち主の中の物は相対(閉じた lib の単体の tsconfig は自分の @/lib/<名前> を解かない)、ほかは @/
 * @param {string} owner 点の持ち主のフォルダ
 * @param {string} target リポジトリ直下からのパス(拡張子つき)か "@/…" の import 元
 */
const specifierOf = (owner, target) => {
  const path = target.startsWith("@/") ? `${SEARCH_ROOT}/${target.slice(2)}` : target.replace(/(\/index)?\.tsx?$/, "");
  if (path.startsWith(`${owner}/`)) return posix.relative(`${owner}/${EXTENSIONS_DIR_NAME}`, path);
  return target.startsWith("@/") ? target : `@/${path.slice(`${SEARCH_ROOT}/`.length)}`;
};
const portOf = (capability) => capability.slice(0, capability.indexOf("."));

/**
 * 選ぶ点の持ち主の公開の入口(起動時の知らせが口の状態を読む先): lib = "./server" を宣言していればそれ、無ければ "."、
 * ドメイン = services/server の入口。import 元とファイル
 * @param {string} repoRoot
 * @param {string} owner 点の持ち主のフォルダ(src/lib/<名前> か src/domains/…)
 * @returns {{ specifier: string, file: string | null }}
 */
export function publicEntryOf(repoRoot, owner) {
  if (owner.startsWith(DOMAINS_ROOT)) {
    const rest = owner.slice(DOMAINS_ROOT.length).replace(/^core\//, "");
    const dir = `${owner}/services/server`;
    const file = ["index.ts", "index.tsx"].map((f) => `${dir}/${f}`).find((f) => existsSync(join(repoRoot, f))) ?? null;
    return { specifier: `@/domains/${rest}/services/server`, file };
  }
  const name = owner.slice(`${SEARCH_ROOT}/lib/`.length);
  const pkg = readLibPackage(repoRoot, name);
  const entry = pkg?.exports.find((e) => e.key === "./server") ?? pkg?.exports.find((e) => e.key === ".") ?? null;
  const file = entry ? `${owner}/${entry.targetPath}` : ["index.ts", "index.tsx"].map((f) => `${owner}/${f}`).find((f) => existsSync(join(repoRoot, f))) ?? null;
  return { specifier: entry && entry.key === "./server" ? `@/lib/${name}/server` : `@/lib/${name}`, file };
}

/** 入口のファイルの字面が名前を export するか(export const / function / { … } の名前、re-export も) */
const exportsName = (text, name) => new RegExp(`export\\s+(?:const|let|function)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text);

/**
 * 予約の名前(none / fake)を src/lib/backends/reserved.ts から字面で読む
 * @param {string} repoRoot
 * @returns {{ none: string, fake: string } | { problem: string }}
 */
export function readReservedNames(repoRoot) {
  const abs = join(repoRoot, RESERVED_FILE);
  if (!existsSync(abs)) return { problem: `${RESERVED_FILE}: 予約の実装の名前の正が無い(選ぶ点は src/lib/backends を要る)` };
  const text = readFileSync(abs, "utf8");
  /** @type {Record<string, string>} */
  const names = {};
  for (const name of ["NONE_IMPLEMENTATION", "FAKE_IMPLEMENTATION"]) {
    const initializer = exportedInitializer(RESERVED_FILE, text, name);
    const read = initializer ? literalOf(initializer) : null;
    if (!read || typeof read.value !== "string") return { problem: `${RESERVED_FILE}: export const ${name} = "<名前>" が字面で読めない` };
    names[name] = read.value;
  }
  return { none: names.NONE_IMPLEMENTATION, fake: names.FAKE_IMPLEMENTATION };
}

/**
 * 機能(門番の規則)の開閉。env GATES_FEATURES(JSON、テスト用)か、段階のランナーと同じ scripts/runner/phases/features.ts を tsx で
 * @param {string} repoRoot
 * @returns {{ states: Record<string, boolean> } | { problem: string }}
 */
export function readFeatureStates(repoRoot) {
  if (process.env.GATES_FEATURES) return { states: JSON.parse(process.env.GATES_FEATURES) };
  const r = spawnSync("npx", ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", "./scripts/runner/phases/features.ts"], { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) return { problem: `機能の開閉が読めない(backendRequirements を開いているドメインだけ数えるため): ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" / ")}` };
  return { states: JSON.parse(r.stdout) };
}

/**
 * 能力の語の増設点 backendCapabilities の項目 export const capabilities = { port, words } を字面で読む
 * @param {{ path: string, text: string }} item
 * @returns {{ port: string, words: string[] } | { problem: string }}
 */
function readCapabilities(item) {
  const initializer = exportedInitializer(item.path, item.text, CAPABILITIES_EXPORT);
  const read = initializer ? literalOf(initializer) : { problem: `export const ${CAPABILITIES_EXPORT} が無い` };
  const shape = `${item.path}: ${CAPABILITIES_EXPORT} は { port: "<口>", words: ["<語>", …] } の字面`;
  if (read.problem !== undefined) return { problem: `${shape}(${read.problem})` };
  const v = read.value;
  if (typeof v !== "object" || v === null || Array.isArray(v) || !Object.keys(v).every((k) => ["port", "words"].includes(k))) return { problem: shape };
  if (typeof v.port !== "string" || !WORD.test(v.port) || !Array.isArray(v.words) || v.words.length === 0 || !v.words.every((w) => typeof w === "string" && WORD.test(w))) return { problem: shape };
  return { port: v.port, words: /** @type {string[]} */ (v.words) };
}

/**
 * 選ぶ点の生成物と問題を組み立てる
 * @param {{
 *   repoRoot: string,
 *   points: { owner: string, name: string, declaredIn: string, spec: Record<string, any> }[],
 *   itemsByPoint: Map<object, { name: string, path: string, text: string, plug: { domain: string | null } }[]>,
 *   alwaysOpen: string[],
 *   backendRequirements: { domain: string, declaredIn: string, requires: string[] }[],
 *   gateDomains: { folder: string, features: string[] }[],
 *   headerFor: (source: string) => string,
 *   featureStates?: () => ({ states: Record<string, boolean> } | { problem: string }),
 *   phase?: string,
 *   env?: Record<string, string | undefined>,
 * }} input gateDomains = 門番の規則に載るドメインと載せる規則(生成一覧 rules の domains)。phase = 段(既定 env PHASE)、env = 見る env(既定 process.env)
 * @returns {{ paths: string[], outputs: Record<string, string>, problems: string[], warnings: string[], statusEntries: { name: string, port: string, path: string, load: string }[] }}
 *   statusEntries = 起動時の知らせの行(点 startupTasks の一覧に足す。選択表の問題に左右されない: 持ち主の入口の状態を読むだけ)
 */
export function planSelection(input) {
  const { repoRoot, points, itemsByPoint, alwaysOpen, backendRequirements, gateDomains, headerFor } = input;
  const phase = input.phase ?? process.env.PHASE ?? "-";
  const env = input.env ?? process.env;
  /** @type {Record<string, string>} */
  const outputs = {};
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const warnings = [];
  const selectPoints = points.filter((p) => isSelectPoint(p.spec));
  // 選ぶ点の持ち物の生成物(問題がある時も数える: 生成と検査は問題の間これを書かず・消さず・古いと数えない)
  /** @type {string[]} */
  const paths = selectPoints.map((p) => `${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.ts`);
  // 起動時の知らせの行(点 startupTasks が在る時、選ぶ点ごと): 持ち主の公開の入口の <点>BackendStatus を読む。入口に無ければ止める
  /** @type {{ name: string, port: string, path: string, load: string }[]} */
  const statusEntries = [];
  if (points.some((p) => p.name === STATUS_POINT && p.spec.plugs === true)) {
    for (const p of selectPoints) {
      const name = `${p.name}${STATUS_EXPORT_SUFFIX}`;
      const entry = publicEntryOf(repoRoot, p.owner);
      if (!entry.file || !exportsName(readFileSync(join(repoRoot, entry.file), "utf8"), name)) {
        problems.push(`${p.declaredIn}: 選ぶ点 ${p.name} の持ち主の公開の入口 ${entry.specifier}(${entry.file ?? "無い"})が ${name} を出さない(起動時の知らせが読む口の状態 { port, selected, isConfigured }。@/lib/backends の BackendStatus、D49)`);
        continue;
      }
      const load = `async () => { if (process.env.NEXT_RUNTIME === "nodejs") { const { createBackendStatusTask } = await import("@/lib/backends"); const { ${name} } = await import(${JSON.stringify(entry.specifier)}); return createBackendStatusTask(${name}); } return { name: ${JSON.stringify(`backends.${p.spec.select.port}`)}, runtime: "nodejs", run: () => {} }; }`;
      statusEntries.push({ name, port: p.spec.select.port, path: entry.file, load });
    }
  }

  // 能力の語: 口 → 語 → 定めた所(選ぶ点の select.words と backendCapabilities の項目。同じ語の 2 度目は止める、D19)
  /** @type {Map<string, Map<string, string>>} */
  const words = new Map();
  const define = (port, word, where) => {
    const known = words.get(port) ?? new Map();
    words.set(port, known);
    if (known.has(word) && known.get(word) !== where) return `${where}: 能力の語 ${port}.${word} は ${known.get(word)} で定まっている(語の再定義は止める。fork の語は別の名前にする)`;
    known.set(word, where);
    return null;
  };
  for (const p of selectPoints) for (const word of p.spec.select.words) define(p.spec.select.port, word, `選ぶ点 ${p.spec.select.port}`);
  const capabilitiesPoint = points.find((p) => p.owner === CAPABILITIES_OWNER && p.name === CAPABILITIES_POINT);
  for (const item of (capabilitiesPoint && itemsByPoint.get(capabilitiesPoint)) ?? []) {
    const read = readCapabilities(item);
    if ("problem" in read) {
      problems.push(read.problem);
      continue;
    }
    if (!selectPoints.some((p) => p.spec.select.port === read.port)) {
      problems.push(`${item.path}: 口 ${read.port} は選ぶ点に無い(能力の語は在る口にだけ足せる)`);
      continue;
    }
    for (const word of read.words) {
      const problem = define(read.port, word, item.path);
      if (problem) problems.push(problem);
    }
  }
  if (selectPoints.length === 0) return { paths, outputs, problems, warnings, statusEntries };

  const reserved = readReservedNames(repoRoot);
  if ("problem" in reserved) return { paths, outputs, warnings, statusEntries, problems: [...problems, reserved.problem] };
  const knownCapability = (name) => words.get(portOf(name))?.has(name.slice(name.indexOf(".") + 1)) === true;

  // 口ごとの点・任意か
  /** @type {Map<string, typeof selectPoints>} */
  const byPort = new Map();
  for (const p of selectPoints) byPort.set(p.spec.select.port, [...(byPort.get(p.spec.select.port) ?? []), p]);
  /** @type {Map<string, boolean>} */
  const optionalOf = new Map();
  for (const [port, group] of byPort) {
    const flags = new Set(group.map((p) => p.spec.select.optional === true));
    if (flags.size > 1) problems.push(`口 ${port} の選ぶ点の select.optional が揃っていない(${group.map((p) => `${p.declaredIn} の ${p.name}`).join("・")})`);
    optionalOf.set(port, group.every((p) => p.spec.select.optional === true));
  }

  // 項目: 名前 → 宣言(点ごと)。予約名・置き場・宣言の形・知らない語を止める
  /** @type {Map<object, Map<string, { path: string, provides: string[], requires: string[], envRequired: string[], requiresFeatures: string[] }>>} */
  const declared = new Map();
  for (const p of selectPoints) {
    const port = p.spec.select.port;
    const byItem = new Map();
    declared.set(p, byItem);
    for (const stem of ["default", "replace"]) {
      for (const ext of ["ts", "tsx"]) {
        const path = `${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.${stem}.${ext}`;
        if (existsSync(join(repoRoot, path))) problems.push(`${path}: 選ぶ点 ${p.name} に .${stem} は置けない(実装は plugs/${p.name}/<名前>.ts の項目、選ぶのは ${SELECTION_FILE})`);
      }
    }
    for (const item of itemsByPoint.get(p) ?? []) {
      if (item.name === reserved.none || item.name === reserved.fake) {
        problems.push(`${item.path}: 項目の名前 ${item.name} は予約(none = 組み込みの使わない、fake = 持ち主の差し替え口で入れるテストの偽物)`);
        continue;
      }
      // 置き場(D10): lib の口 = lib の項目だけ、常設ドメインの口 = そのドメインか lib
      const ownerIsLib = !p.owner.startsWith(DOMAINS_ROOT);
      const inLib = item.plug.domain === null;
      if (!(inLib || (!ownerIsLib && item.path.startsWith(`${p.owner}/`)))) {
        problems.push(`${item.path}: 選ぶ点 ${p.name}(${p.owner})の項目は ${ownerIsLib ? "lib" : "持ち主のドメインか lib"} にだけ置ける(D10。fork の実装は自分の lib の plugs/${p.name}/)`);
        continue;
      }
      const read = readBackendDeclaration(item.path, item.text);
      problems.push(...read.problems);
      if (!read.declaration) continue;
      for (const name of read.declaration.provides) {
        if (portOf(name) !== port) problems.push(`${item.path}: provides の ${name} は口 ${port} の能力でない(実装が出すのは自分の口の能力だけ)`);
        else if (!knownCapability(name)) problems.push(`${item.path}: provides の ${name} は知らない語(口 ${port} の語: ${[...(words.get(port)?.keys() ?? [])].join(", ")}。足すなら backendCapabilities の項目)`);
      }
      for (const name of read.declaration.requires) if (!knownCapability(name)) problems.push(`${item.path}: requires の ${name} は知らない能力(在る口の select.words か backendCapabilities の語)`);
      byItem.set(item.name, {
        path: item.path,
        provides: read.declaration.provides,
        requires: read.declaration.requires,
        envRequired: read.declaration.env.required,
        requiresFeatures: read.declaration.requiresFeatures,
      });
    }
  }
  for (const r of backendRequirements) for (const name of r.requires) if (!knownCapability(name)) problems.push(`${r.declaredIn}: backendRequirements の ${name} は知らない能力(在る口の select.words か backendCapabilities の語)`);

  // 選択表
  const tablePath = join(repoRoot, SELECTION_FILE);
  if (!existsSync(tablePath)) return { paths, outputs, warnings, statusEntries, problems: [...problems, `${SELECTION_FILE} が無い(選ぶ点 ${selectPoints.length} 個の口を選ぶ表。${FILL} で書く)`] };
  /** @type {unknown} */
  let table;
  try {
    table = JSON.parse(readFileSync(tablePath, "utf8"));
  } catch (error) {
    return { paths, outputs, warnings, statusEntries, problems: [...problems, `${SELECTION_FILE}: JSON として読めない(${error instanceof Error ? error.message : String(error)})`] };
  }
  if (typeof table !== "object" || table === null || Array.isArray(table)) return { paths, outputs, warnings, statusEntries, problems: [...problems, `${SELECTION_FILE} は { "<口>": "<実装の名前>" } の object`] };
  const selection = /** @type {Record<string, unknown>} */ (table);
  for (const key of Object.keys(selection).sort(byName)) if (!byPort.has(key)) problems.push(`${SELECTION_FILE}: 鍵 ${key} は知らない口(選ぶ点の port に無い。消すか、口の名前を直す: ${SET})`);
  /** @type {Map<string, string>} */
  const chosen = new Map();
  for (const [port, group] of [...byPort.entries()].sort(([a], [b]) => byName(a, b))) {
    const value = selection[port];
    if (value === undefined) {
      problems.push(`${SELECTION_FILE}: 口 ${port} の鍵が無い(${FILL} で今の設定から書く)`);
      continue;
    }
    if (typeof value !== "string" || value.length === 0) {
      problems.push(`${SELECTION_FILE}: 口 ${port} の値は実装の名前の文字列(${SET})`);
      continue;
    }
    if (value === reserved.fake) {
      problems.push(`${SELECTION_FILE}: 口 ${port} に "${reserved.fake}" は選べない(テストの偽物は持ち主の差し替え口で入れる。${SET})`);
      continue;
    }
    if (value === reserved.none) {
      if (!optionalOf.get(port)) problems.push(`${SELECTION_FILE}: 口 ${port} は任意でない(select.optional が無い)ので "${reserved.none}" は選べない(${SET})`);
      else chosen.set(port, value);
      continue;
    }
    const having = group.filter((p) => declared.get(p)?.has(value) || (itemsByPoint.get(p) ?? []).some((i) => i.name === value));
    if (having.length === 0) {
      const names = [...new Set(group.flatMap((p) => (itemsByPoint.get(p) ?? []).map((i) => i.name)))].sort(byName);
      problems.push(`${SELECTION_FILE}: 口 ${port} の "${value}" は知らない実装(在る名前: ${names.join(", ") || "なし"}${optionalOf.get(port) ? `, ${reserved.none}` : ""}。${SET})`);
      continue;
    }
    for (const p of group.filter((point) => !having.includes(point))) problems.push(`${p.declaredIn}: 口 ${port} の点 ${p.name} に項目 "${value}" が無い(口の全部の点に同じ名前の項目を置く: ${p.owner}/plugs/${p.name}/${value}.ts、D17)`);
    chosen.set(port, value);
  }

  // requires ↔ provides(選んだ実装の provides の和)
  const provided = new Set();
  for (const p of selectPoints) {
    const name = chosen.get(p.spec.select.port);
    for (const capability of declared.get(p)?.get(name ?? "")?.provides ?? []) provided.add(capability);
  }
  for (const p of selectPoints) {
    const name = chosen.get(p.spec.select.port);
    const item = declared.get(p)?.get(name ?? "");
    if (!item) continue;
    for (const capability of item.requires) if (!provided.has(capability)) problems.push(`${item.path}: requires の ${capability} を選択表のどの実装も出さない(口 ${portOf(capability)} の選択を見直す: ${SET})`);
  }

  // 選んだ実装の requiresFeatures(口ごと、その口の全部の点の選んだ項目の分。選ばれていない項目のは読まない)
  /** @type {{ path: string, port: string, name: string, feature: string }[]} */
  const featureNeeds = [];
  for (const p of selectPoints) {
    const name = chosen.get(p.spec.select.port);
    const item = declared.get(p)?.get(name ?? "");
    if (!item || name === undefined) continue;
    for (const feature of item.requiresFeatures) featureNeeds.push({ path: item.path, port: p.spec.select.port, name, feature });
  }

  // 開いているドメインの backendRequirements(常設か、載せる規則のどれかが開。どの規則にも載らず常設でもないドメインは閉)
  const ruleHolders = new Map(gateDomains.map((d) => [d.folder, d.features]));
  const needStates =
    featureNeeds.length > 0 || backendRequirements.some((r) => !alwaysOpen.includes(r.domain) && ruleHolders.has(r.domain.slice(DOMAINS_ROOT.length)));
  /** @type {Record<string, boolean>} */
  let states = {};
  if (needStates) {
    const read = (input.featureStates ?? (() => readFeatureStates(repoRoot)))();
    if ("problem" in read) return { paths, outputs, warnings, statusEntries, problems: [...problems, read.problem] };
    states = read.states;
  }
  for (const need of featureNeeds) {
    const others = [...new Set(selectPoints.filter((p) => p.spec.select.port === need.port).flatMap((p) => [...(declared.get(p)?.keys() ?? [])]))]
      .filter((n) => n !== need.name)
      .sort(byName);
    const pick = `別の実装を選ぶ: pnpm workflow backend-selection set ${need.port} <${others.join("|") || "実装の名前"}>`;
    if (!(need.feature in states)) {
      problems.push(`${need.path}: 口 ${need.port} の選んだ実装 "${need.name}" の requiresFeatures の ${need.feature} は知らない機能(門番の規則 src/featureGate/rules/<名前>.ts の名前。直すか、${pick})`);
    } else if (states[need.feature] !== true) {
      problems.push(`${need.path}: 口 ${need.port} の選んだ実装 "${need.name}" は機能 ${need.feature} が開いていないと動かない(機能を開く: pnpm ops features set ${need.feature} on。または ${pick})`);
    }
  }
  for (const r of backendRequirements) {
    const open = alwaysOpen.includes(r.domain) || (ruleHolders.get(r.domain.slice(DOMAINS_ROOT.length)) ?? []).some((rule) => states[rule] === true);
    if (!open) continue;
    for (const capability of r.requires) {
      if (knownCapability(capability) && !provided.has(capability)) problems.push(`${r.declaredIn}: 開いているドメインが要る ${capability} を選択表のどの実装も出さない(口 ${portOf(capability)} の選択を見直す: ${SET})`);
    }
  }
  // env の今の設定と選択の食い違い(段 build・ship、D14): 在って空でない値を compat で写し(map に無い値は default、使う時の send の守りと同じ)、
  // 選んだ名前と違えば止める。値は出さない
  if (ENV_GUARD_PHASES.includes(phase)) {
    for (const [port, group] of [...byPort.entries()].sort(([a], [b]) => byName(a, b))) {
      const name = chosen.get(port);
      const compat = group[0].spec.select.compat;
      if (name === undefined || compat.from !== "env") continue;
      const raw = (env[compat.name] ?? "").trim();
      if (raw === "") continue;
      const mapped = Object.hasOwn(compat.map, raw) ? compat.map[raw] : compat.default;
      if (mapped !== name) {
        problems.push(`${SELECTION_FILE}: 口 ${port} は "${name}" を選ぶが、env ${compat.name} は "${mapped}" を指す(段 ${phase}。直す: pnpm workflow backend-selection set ${port} ${mapped} か、env ${compat.name} を消す)`);
      }
    }
  }
  // 選んだ実装の env.required の欠け(段 build、止めない): offline の段で runner が外す名前(OFFLINE_ENV)は見えないので見ない(起動時の知らせが見る)
  if (ENV_NOTICE_PHASES.includes(phase)) {
    for (const p of selectPoints) {
      const item = declared.get(p)?.get(chosen.get(p.spec.select.port) ?? "");
      if (!item) continue;
      const missing = item.envRequired.filter((n) => !(OFFLINE_PHASES.includes(phase) && OFFLINE_ENV.test(n)) && (env[n] ?? "").trim() === "");
      if (missing.length > 0) warnings.push(`口 ${p.spec.select.port} の選んだ実装 "${chosen.get(p.spec.select.port)}"(${item.path})の env が無い: ${missing.join(", ")}(段 ${phase}。止めない)`);
    }
  }
  if (problems.length > 0) return { paths, outputs, problems, warnings, statusEntries };

  // 生成物: 選んだ 1 項目の adapter だけを静的に re-export(none = 組み込みの none の adapter)
  for (const p of selectPoints) {
    const port = p.spec.select.port;
    const name = /** @type {string} */ (chosen.get(port));
    const head = [headerFor(`${p.declaredIn}・${SELECTION_FILE}`), `// ${p.name}: 口 ${port} の選んだ実装 "${name}"(${SELECTION_FILE})。選ばない実装は読まない`, ""];
    // 選んだ名前と今の設定の読み方(宣言の select.compat の写し)。使う時の食い違いの守りが読む(D11・D14)
    const facts = [
      "/** 選択表が選んだ実装の名前 */",
      `export const selected = ${JSON.stringify(name)} as const;`,
      "/** 今の設定の読み方(宣言の select.compat の写し) */",
      `export const compat = ${JSON.stringify(p.spec.select.compat)} as const;`,
      "",
    ];
    if (name === reserved.none) {
      outputs[`${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.ts`] = [
        ...head,
        'import { createNoneAdapter } from "@/lib/backends";',
        `import type { ${p.spec.type.name} } from ${JSON.stringify(specifierOf(p.owner, p.spec.type.from))};`,
        "",
        `export const ${BACKEND_ADAPTER_NAME} = createNoneAdapter<${p.spec.type.name}>(${JSON.stringify(port)});`,
        "",
        ...facts,
      ].join("\n");
    } else {
      const item = /** @type {{ path: string }} */ (declared.get(p)?.get(name));
      outputs[`${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.ts`] = [...head, `export { ${BACKEND_ADAPTER_NAME} } from ${JSON.stringify(specifierOf(p.owner, item.path))};`, "", ...facts].join("\n");
    }
  }
  return { paths, outputs, problems, warnings, statusEntries };
}
