// scripts/structure/registry/alpha/recordTargetRegistry.mjs
// 記録の宛先の一覧 src/registry/recordTargetRegistry.ts を走査から組み立てる(pnpm generate registry)。字面で読むだけ(項目は import しない)。
// 連絡定義(./messageRegistry.mjs)と同じ道(決定 D195、指令 04 の AMENDMENT 1):
// - 項目 = features の地区の recordTargets/<名前>.ts(直下。.test・点つきの名前は除く)の export const recordTarget = { key: "…", … }
// - 鍵 = 項目の key の文字列リテラルで、<ドメインのフォルダ名>.<ファイル名> と一致すること(場所から一意に決まる。ずれ・重なりは止める)
// - 一覧は絞らない(門で閉じたドメインの項目は使う時に門番 recordTargetOpen が落とす。messaging/services/server/domainGate.ts)
// 型と読み手: src/lib/messaging/README.md「記録の宛先」

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { exportedObject, readLiteralProperty } from "../../extensions/derive/messageGuards.mjs";

export const RECORD_TARGET_REGISTRY_FILE = "src/registry/recordTargetRegistry.ts";
const RECORD_TARGETS_DIR = "recordTargets";
const RECORD_TARGET_EXPORT = "recordTarget";
const PLAIN_NAME = /^[a-z][A-Za-z0-9]*$/;

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const listFiles = (repoRoot, dir) =>
  existsSync(join(repoRoot, dir))
    ? readdirSync(join(repoRoot, dir), { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort(byString)
    : [];

/**
 * @param {string} repoRoot
 * @returns {{ entries: { key: string, domain: string, path: string }[], problems: string[] }}
 */
export function scanRecordTargets(repoRoot) {
  const problems = [];
  const entries = [];
  const districts = readDistrictMapAt(repoRoot).districts.filter((d) => d.kind === "features");
  for (const district of districts) {
    const dir = `${district.dir}/${RECORD_TARGETS_DIR}`;
    const domain = district.dir.split("/").at(-1);
    for (const file of listFiles(repoRoot, dir)) {
      const match = /^(.+)\.ts$/.exec(file);
      if (!match || /\.test\.ts$/.test(file)) continue;
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
      entries.push({ key: key.value, domain, path });
    }
  }
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.key)) problems.push(`${entry.path}: 鍵 ${entry.key} が ${seen.get(entry.key)} と重なる(ドメインのフォルダ名が core と業務で同じ)`);
    seen.set(entry.key, entry.path);
  }
  return { entries: entries.sort((a, b) => byString(a.key, b.key)), problems };
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
    "  },",
  ]);
  const text = [
    "// 生成物・編集不可: pnpm generate registry が src/features/**/recordTargets/*.ts から生成する",
    `// ${RECORD_TARGET_REGISTRY_FILE}`,
    "//",
    "// 記録の宛先の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → ドメイン・項目の遅延 import)。絞らない: 読み手は loadRecordTarget(門番 recordTargetOpen)を通す",
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
