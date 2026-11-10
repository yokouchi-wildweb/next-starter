// scripts/structure/registry/alpha/messageRegistry.mjs
// 連絡の一覧 src/registry/messageRegistry.ts を走査から組み立てる(pnpm generate registry)。字面で読むだけ(定義は import しない)。
// - 定義 = features の地区の messages/<名前>.ts(直下。.override・.test・点つきの名前は除く)の export const message = defineMessage({ key: "…", … })
// - 鍵 = 定義の key の文字列リテラルで、<ドメインのフォルダ名>.<ファイル名> と一致すること(場所から一意に決まる。ずれ・重なりは止める)
// - 上書き = 隣の <名前>.override.ts、描き方 = messages/views/<名前>.tsx(1 行スイッチ。.default / .replace は一覧に出さない)。定義の無い描き方は止める
// 値の検査(欄・{{鍵}}・required の守り)は lib/messaging の validateMessageDefinition(実行時)と pnpm check extensions(字面の守り)
// 書式と読み手: src/lib/messaging/README.md「生成の一覧」

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { MESSAGE_EXPORT, exportedObject, readLiteralProperty } from "../../extensions/derive/messageGuards.mjs";

export const MESSAGE_REGISTRY_FILE = "src/registry/messageRegistry.ts";
const MESSAGES_DIR = "messages";
const VIEWS_DIR = "views";
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
 * @returns {{ entries: { key: string, definition: string, override: string | null, view: string | null }[], problems: string[] }}
 */
export function scanMessages(repoRoot) {
  const problems = [];
  const entries = [];
  const districts = readDistrictMapAt(repoRoot).districts.filter((d) => d.kind === "features");
  for (const district of districts) {
    const dir = `${district.dir}/${MESSAGES_DIR}`;
    const domain = district.dir.split("/").at(-1);
    const files = listFiles(repoRoot, dir);
    const names = [];
    for (const file of files) {
      const match = /^(.+)\.ts$/.exec(file);
      if (!match || file.endsWith(".override.ts") || /\.test\.ts$/.test(file)) continue;
      const name = match[1];
      if (!PLAIN_NAME.test(name)) {
        problems.push(`${dir}/${file}: 連絡の定義のファイル名は英小文字始まりの camelCase(点や印は付けない)`);
        continue;
      }
      const path = `${dir}/${file}`;
      const object = exportedObject(path, readFileSync(join(repoRoot, path), "utf8"), MESSAGE_EXPORT);
      if (!object) {
        problems.push(`${path}: 連絡の定義は export const ${MESSAGE_EXPORT} = defineMessage({ … }) の形で書く`);
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
      names.push(name);
      const override = `${dir}/${name}.override.ts`;
      const view = `${dir}/${VIEWS_DIR}/${name}.tsx`;
      entries.push({
        key: key.value,
        definition: path,
        override: existsSync(join(repoRoot, override)) ? override : null,
        view: existsSync(join(repoRoot, view)) ? view : null,
      });
    }
    for (const file of listFiles(repoRoot, `${dir}/${VIEWS_DIR}`)) {
      const name = /^([^.]+)\.tsx$/.exec(file)?.[1];
      if (name && !names.includes(name)) problems.push(`${dir}/${VIEWS_DIR}/${file}: 描き方に対応する連絡の定義 ${dir}/${name}.ts が無い`);
    }
  }
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.key)) problems.push(`${entry.definition}: 鍵 ${entry.key} が ${seen.get(entry.key)} と重なる(ドメインのフォルダ名が core と業務で同じ)`);
    seen.set(entry.key, entry.definition);
  }
  return { entries: entries.sort((a, b) => byString(a.key, b.key)), problems };
}

const specifierOf = (path) => `@/${path.slice("src/".length).replace(/\.tsx?$/, "")}`;

/**
 * @param {string} repoRoot
 * @returns {{ text: string, problems: string[] }}
 */
export function renderMessageRegistry(repoRoot) {
  const { entries, problems } = scanMessages(repoRoot);
  const body = entries.flatMap((e) => [
    `  ${JSON.stringify(e.key)}: {`,
    `    key: ${JSON.stringify(e.key)},`,
    `    definition: () => import(${JSON.stringify(specifierOf(e.definition))}),`,
    ...(e.override ? [`    override: () => import(${JSON.stringify(specifierOf(e.override))}),`] : []),
    ...(e.view ? [`    view: () => import(${JSON.stringify(specifierOf(e.view))}),`] : []),
    "  },",
  ]);
  const text = [
    "// 生成物・編集不可: pnpm generate registry が src/features/**/messages/*.ts・*.override.ts・views/<名前>.tsx から生成する",
    `// ${MESSAGE_REGISTRY_FILE}`,
    "//",
    "// 連絡の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → 定義・上書き・描き方の遅延 import)。送る口・管理画面・プレビューが読む。型と決まり: src/lib/messaging/README.md",
    "",
    'import "server-only";',
    "",
    'import type { MessageRegistry } from "@/lib/messaging";',
    "",
    entries.length > 0 ? "export const messageRegistry: MessageRegistry = {" : "export const messageRegistry: MessageRegistry = {};",
    ...(entries.length > 0 ? [...body, "};"] : []),
    "",
  ].join("\n");
  return { text, problems };
}
