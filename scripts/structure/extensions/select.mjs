// scripts/structure/extensions/select.mjs
// 選ぶ点(extensionPoints.ts の点に select を足した plugs の点、D9・D36)の生成と検査(pnpm generate extensions / pnpm check extensions の一部)。
// - 項目 <持ち主>/plugs/<点>/<名前>.ts の export const declaration を構文木で読む(実行しない、読み手 src/lib/districtMap/declarations.mjs)
// - 根の backend-selection.json({ <口>: <実装の名前> })が指す 1 項目の adapter だけを <持ち主>/extensions/<点>.ts に静的に re-export する
//   ("none" = 組み込みの none の adapter、@/lib/backends の createNoneAdapter)
// - 食い違いで止める(D14 fail-closed): 選択表の鍵の欠け・余り・知らない値・"fake"・任意でない口の "none"・口のどれかの点に項目が無い・
//   requires ↔ provides の不足・開いているドメインの backendRequirements の不足・項目の宣言の形・知らない語・語の再定義
// - 選ぶ点が 0 個なら選択表を読まず、何も書かず、止めない
// 書式: ./README.md「選ぶ点」

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
const DOMAINS_ROOT = `${SEARCH_ROOT}/domains/`;
const WORD = /^[a-z][A-Za-z0-9]*$/;

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const specifierOf = (path) => `@/${path.slice(`${SEARCH_ROOT}/`.length).replace(/(\/index)?\.tsx?$/, "")}`;
const portOf = (capability) => capability.slice(0, capability.indexOf("."));

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
 * }} input gateDomains = 門番の規則に載るドメインと載せる規則(生成一覧 rules の domains)
 * @returns {{ outputs: Record<string, string>, problems: string[] }}
 */
export function planSelection(input) {
  const { repoRoot, points, itemsByPoint, alwaysOpen, backendRequirements, gateDomains, headerFor } = input;
  /** @type {Record<string, string>} */
  const outputs = {};
  /** @type {string[]} */
  const problems = [];
  const selectPoints = points.filter((p) => isSelectPoint(p.spec));

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
  if (selectPoints.length === 0) return { outputs, problems };

  const reserved = readReservedNames(repoRoot);
  if ("problem" in reserved) return { outputs, problems: [...problems, reserved.problem] };
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
  /** @type {Map<object, Map<string, { path: string, provides: string[], requires: string[] }>>} */
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
      byItem.set(item.name, { path: item.path, provides: read.declaration.provides, requires: read.declaration.requires });
    }
  }
  for (const r of backendRequirements) for (const name of r.requires) if (!knownCapability(name)) problems.push(`${r.declaredIn}: backendRequirements の ${name} は知らない能力(在る口の select.words か backendCapabilities の語)`);

  // 選択表
  const tablePath = join(repoRoot, SELECTION_FILE);
  if (!existsSync(tablePath)) return { outputs, problems: [...problems, `${SELECTION_FILE} が無い(選ぶ点 ${selectPoints.length} 個の口を選ぶ表。${FILL} で書く)`] };
  /** @type {unknown} */
  let table;
  try {
    table = JSON.parse(readFileSync(tablePath, "utf8"));
  } catch (error) {
    return { outputs, problems: [...problems, `${SELECTION_FILE}: JSON として読めない(${error instanceof Error ? error.message : String(error)})`] };
  }
  if (typeof table !== "object" || table === null || Array.isArray(table)) return { outputs, problems: [...problems, `${SELECTION_FILE} は { "<口>": "<実装の名前>" } の object`] };
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

  // 開いているドメインの backendRequirements(常設か、載せる規則のどれかが開。どの規則にも載らず常設でもないドメインは閉)
  const ruleHolders = new Map(gateDomains.map((d) => [d.folder, d.features]));
  const needStates = backendRequirements.some((r) => !alwaysOpen.includes(r.domain) && ruleHolders.has(r.domain.slice(DOMAINS_ROOT.length)));
  /** @type {Record<string, boolean>} */
  let states = {};
  if (needStates) {
    const read = (input.featureStates ?? (() => readFeatureStates(repoRoot)))();
    if ("problem" in read) return { outputs, problems: [...problems, read.problem] };
    states = read.states;
  }
  for (const r of backendRequirements) {
    const open = alwaysOpen.includes(r.domain) || (ruleHolders.get(r.domain.slice(DOMAINS_ROOT.length)) ?? []).some((rule) => states[rule] === true);
    if (!open) continue;
    for (const capability of r.requires) {
      if (knownCapability(capability) && !provided.has(capability)) problems.push(`${r.declaredIn}: 開いているドメインが要る ${capability} を選択表のどの実装も出さない(口 ${portOf(capability)} の選択を見直す: ${SET})`);
    }
  }
  if (problems.length > 0) return { outputs, problems };

  // 生成物: 選んだ 1 項目の adapter だけを静的に re-export(none = 組み込みの none の adapter)
  for (const p of selectPoints) {
    const port = p.spec.select.port;
    const name = /** @type {string} */ (chosen.get(port));
    const head = [headerFor(`${p.declaredIn}・${SELECTION_FILE}`), `// ${p.name}: 口 ${port} の選んだ実装 "${name}"(${SELECTION_FILE})。選ばない実装は読まない`, ""];
    if (name === reserved.none) {
      outputs[`${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.ts`] = [
        ...head,
        'import { createNoneAdapter } from "@/lib/backends";',
        `import type { ${p.spec.type.name} } from ${JSON.stringify(p.spec.type.from)};`,
        "",
        `export const ${BACKEND_ADAPTER_NAME} = createNoneAdapter<${p.spec.type.name}>(${JSON.stringify(port)});`,
        "",
      ].join("\n");
    } else {
      const item = /** @type {{ path: string }} */ (declared.get(p)?.get(name));
      outputs[`${p.owner}/${EXTENSIONS_DIR_NAME}/${p.name}.ts`] = [...head, `export { ${BACKEND_ADAPTER_NAME} } from ${JSON.stringify(specifierOf(item.path))};`, ""].join("\n");
    }
  }
  return { outputs, problems };
}
