// scripts/structure/registry/alpha/recordTargetRegistry.mjs
// 記録の宛先の一覧 src/registry/recordTargetRegistry.ts を走査から組み立てる(pnpm generate registry)。字面で読むだけ(項目は import しない)。
// 連絡定義(./messageRegistry.mjs)と同じ道(決定 D195、指令 04 の AMENDMENT 1):
// - 項目 = domains の地区の plugs/recordTargets/<名前>.ts(D42。直下。.test・点つきの名前は除く)の export const recordTarget = { key: "…", … }
// - 鍵 = 項目の key の文字列リテラルで、<ドメインのフォルダ名>.<ファイル名> と一致すること(場所から一意に決まる。ずれ・重なりは止める)
// - 送れる連絡定義の並び = 項目の messages(文字列リテラルの配列、空も可)。隣の <名前>.override.ts の recordTargetOverride.messages が
//   書いてあれば丸ごと差し替える(上書きの点 = lib/messaging の extensionPoints.ts の recordTargets、鍵の検査は pnpm check extensions)
// - 並びの検査(D217・D218): 鍵ごとに連絡定義があり(./messageRegistry.mjs の走査)、その定義の adminTargets に "records" がある
//   (書いていない = ["records"])。外れたら項目(上書きならそのファイル)と鍵を名指して止める
// - 一覧は絞らない(門で閉じたドメインの項目は使う時に門番 recordTargetOpen が落とす。messaging/services/server/domainGate.ts)
// 型と読み手: src/lib/messaging/README.md「記録の宛先」

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PLUGS_DIR_NAME } from "../../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { MESSAGE_EXPORT, exportedObject, readLiteralProperty } from "../../extensions/derive/messageGuards.mjs";
import { scanMessages } from "./messageRegistry.mjs";

export const RECORD_TARGET_REGISTRY_FILE = "src/registry/recordTargetRegistry.ts";
const RECORD_TARGETS_DIR = `${PLUGS_DIR_NAME}/recordTargets`;
/** 段 3 の前の置き場(<ドメイン>/recordTargets/)。残っていれば止めて移し方を案内する */
const OLD_RECORD_TARGETS_DIR = "recordTargets";
const RECORD_TARGET_EXPORT = "recordTarget";
/** 上書きの export(lib/messaging の extensionPoints.ts の recordTargets の export と同じ名前) */
const RECORD_TARGET_OVERRIDE_EXPORT = "recordTargetOverride";
/** 連絡定義の宛先の範囲の既定(lib/messaging の DEFAULT_DEFINITION_ADMIN_TARGETS と同じ) */
const DEFAULT_ADMIN_TARGETS = ["records"];
const PLAIN_NAME = /^[a-z][A-Za-z0-9]*$/;

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const listFiles = (repoRoot, dir) =>
  existsSync(join(repoRoot, dir))
    ? readdirSync(join(repoRoot, dir), { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort(byString)
    : [];

const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

/** messages の字面(配列の文字列リテラル)。問題があれば { problem } */
function readMessages(path, object, required) {
  const read = readLiteralProperty(object, "messages");
  if (!read.present) return required ? { problem: `${path}: messages(送れる連絡定義の鍵の並び、空も可)を文字列リテラルの配列で書く` } : { value: undefined };
  if (read.problem || !isStringArray(read.value)) return { problem: `${path}: messages は文字列リテラルの配列で書く(連絡定義の鍵)` };
  return { value: read.value };
}

/** 連絡定義の鍵 → adminTargets(字面。読めなければ problem) */
function definitionAdminTargets(repoRoot) {
  const map = new Map();
  for (const entry of scanMessages(repoRoot).entries) {
    const object = exportedObject(entry.definition, readFileSync(join(repoRoot, entry.definition), "utf8"), MESSAGE_EXPORT);
    const read = object ? readLiteralProperty(object, "adminTargets") : { present: false };
    if (!read.present) map.set(entry.key, { value: DEFAULT_ADMIN_TARGETS, definition: entry.definition });
    else if (read.problem || !isStringArray(read.value)) map.set(entry.key, { problem: `adminTargets を文字列リテラルの配列で書く`, definition: entry.definition });
    else map.set(entry.key, { value: read.value, definition: entry.definition });
  }
  return map;
}

/**
 * @param {string} repoRoot
 * @returns {{ entries: { key: string, domain: string, path: string, override: string | null, messages: string[] }[], problems: string[] }}
 */
export function scanRecordTargets(repoRoot) {
  const problems = [];
  const entries = [];
  const districts = readDistrictMapAt(repoRoot).districts.filter((d) => d.kind === "domains");
  for (const district of districts) {
    if (existsSync(join(repoRoot, district.dir, OLD_RECORD_TARGETS_DIR))) {
      problems.push(`${district.dir}/${OLD_RECORD_TARGETS_DIR}/: 記録の宛先は ${district.dir}/${RECORD_TARGETS_DIR}/ に置く(D42。fork は段 3 の notice の道具が動かす)`);
    }
    const dir = `${district.dir}/${RECORD_TARGETS_DIR}`;
    const domain = district.dir.split("/").at(-1);
    for (const file of listFiles(repoRoot, dir)) {
      const match = /^(.+)\.ts$/.exec(file);
      if (!match || file.endsWith(".override.ts") || /\.test\.ts$/.test(file)) continue;
      const name = match[1];
      const path = `${dir}/${file}`;
      if (!PLAIN_NAME.test(name)) {
        problems.push(`${path}: 記録の宛先のファイル名は英小文字始まりの camelCase(点や印は付けない)`);
        continue;
      }
      const object = exportedObject(path, readFileSync(join(repoRoot, path), "utf8"), RECORD_TARGET_EXPORT);
      if (!object) {
        problems.push(`${path}: 記録の宛先は export const ${RECORD_TARGET_EXPORT}: MessageRecordTarget = { … } の形で書く`);
        continue;
      }
      const key = readLiteralProperty(object, "key");
      const expected = `${domain}.${name}`;
      if (!key.present || key.problem || typeof key.value !== "string") {
        problems.push(`${path}: key は文字列リテラルで書く("${expected}")`);
        continue;
      }
      if (key.value !== expected) {
        problems.push(`${path}: key "${key.value}" は場所から決まる "${expected}"(<ドメインのフォルダ名>.<ファイル名>)にする`);
        continue;
      }
      const own = readMessages(path, object, true);
      if (own.problem) {
        problems.push(own.problem);
        continue;
      }
      const overridePath = `${dir}/${name}.override.ts`;
      const override = existsSync(join(repoRoot, overridePath)) ? overridePath : null;
      let messages = own.value;
      let messagesFrom = path;
      if (override) {
        const overrideObject = exportedObject(override, readFileSync(join(repoRoot, override), "utf8"), RECORD_TARGET_OVERRIDE_EXPORT);
        // 形の違い・宣言に無い鍵は pnpm check extensions が止める。ここは messages だけを読む
        const read = overrideObject ? readMessages(override, overrideObject, false) : { value: undefined };
        if (read.problem) {
          problems.push(read.problem);
          continue;
        }
        if (read.value !== undefined) {
          messages = read.value;
          messagesFrom = override;
        }
      }
      entries.push({ key: key.value, domain, path, override, messages, messagesFrom });
    }
  }
  const definitions = entries.some((e) => e.messages.length > 0) ? definitionAdminTargets(repoRoot) : new Map();
  for (const entry of entries) {
    for (const messageKey of entry.messages) {
      const definition = definitions.get(messageKey);
      if (!definition) problems.push(`${entry.messagesFrom}: messages の ${messageKey} は連絡定義に無い(<ドメイン>/messages/<名前>.ts の鍵を書く。項目 ${entry.key})`);
      else if (definition.problem) problems.push(`${definition.definition}: ${definition.problem}(項目 ${entry.key} の messages が名指す)`);
      else if (!definition.value.includes("records"))
        problems.push(`${entry.messagesFrom}: messages の ${messageKey} は adminTargets に "records" が無い(${definition.definition}。項目 ${entry.key})`);
    }
  }
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.key)) problems.push(`${entry.path}: 鍵 ${entry.key} が ${seen.get(entry.key)} と重なる(ドメインのフォルダ名が core と業務で同じ)`);
    seen.set(entry.key, entry.path);
  }
  return {
    entries: entries.map((e) => ({ key: e.key, domain: e.domain, path: e.path, override: e.override, messages: e.messages })).sort((a, b) => byString(a.key, b.key)),
    problems,
  };
}

const specifierOf = (path) => `@/${path.slice("src/".length).replace(/\.tsx?$/, "")}`;

/**
 * @param {string} repoRoot
 * @returns {{ text: string, problems: string[] }}
 */
export function renderRecordTargetRegistry(repoRoot) {
  const { entries, problems } = scanRecordTargets(repoRoot);
  const body = entries.flatMap((e) => [
    `  ${JSON.stringify(e.key)}: {`,
    `    key: ${JSON.stringify(e.key)},`,
    `    domain: ${JSON.stringify(e.domain)},`,
    `    target: () => import(${JSON.stringify(specifierOf(e.path))}),`,
    ...(e.override ? [`    override: () => import(${JSON.stringify(specifierOf(e.override))}),`] : []),
    "  },",
  ]);
  const text = [
    "// 生成物・編集不可: pnpm generate registry が src/domains/**/plugs/recordTargets/*.ts・*.override.ts から生成する",
    `// ${RECORD_TARGET_REGISTRY_FILE}`,
    "//",
    "// 記録の宛先の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → ドメイン・項目と上書きの遅延 import)。絞らない: 読み手は loadRecordTarget(門番 recordTargetOpen)を通す",
    "// (messaging/services/server/domainGate.ts)。型と決まり: src/lib/messaging/README.md「記録の宛先」",
    "",
    'import "server-only";',
    "",
    'import type { MessageRecordTargetRegistry } from "@/lib/messaging";',
    "",
    entries.length > 0
      ? "export const recordTargetRegistry: MessageRecordTargetRegistry = {"
      : "export const recordTargetRegistry: MessageRecordTargetRegistry = {};",
    ...(entries.length > 0 ? [...body, "};"] : []),
    "",
  ].join("\n");
  return { text, problems };
}
