// .notices/20261126-014453-domain-decl.registry.mjs
// 登録の道具(登録表、D336): 手書き・生成の services/server/domainEntry.ts をやめ、登録表 src/registry/serviceRegistry.ts を登録の宣言から作る形へ移す。
// 1. fork の上書き services/server/domainEntry.override.ts(export const domainEntryOverrides = { <キー>: <access> })を、キーごとに
//    登録のフォルダ entities/<キー>/entity.override.ts(export const entityOverride = { apiAccess: <access> })へ移す
// 2. 守り: 今の domainEntry.ts の各キーの行(table・idColumn・access・requires・service の結び付き先)が、宣言から作る行(pnpm generate registry と同じ部品)と
//    同じこと、domainEntry.ts の残るドメインの宣言の行に domainEntry.ts に無いキーが無いことを確かめる(core・移し済みのドメインは比べない)。違えば何も書かずに止め、違いを出す(宣言の entity.json を直してから走らせ直す)
// 3. --write: 上書きを書き、domainEntry.ts と domainEntry.override.ts を消す。続けて pnpm generate registry(登録表と集める入口を作り直す)
//
// 使い方(リポのルートで、.ts を読むので tsx の上): npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261126-014453-domain-decl.registry.mjs [--write]
//   既定 = 計画だけ(何も書かない)。domainEntry.ts が 1 本も無ければ何もしない(何度走らせても同じ結果)

import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

import { scanObjectEntries } from "../scripts/structure/domain/text/objectEntry.mjs";
import { OVERRIDE_EXPORT, OVERRIDE_FILE, discoverRegistrations, listDomainDirs } from "../scripts/structure/registry/serviceRegistry/discover.mjs";

const ENTRY_FILE = "services/server/domainEntry.ts";
const OLD_OVERRIDE_FILE = "services/server/domainEntry.override.ts";

/** 相対の指定子を、services/server/ から entities/<登録名>/ へ移ったファイルの道に(どちらもドメインのフォルダから 2 段) */
function relocate(specifier, registration) {
  if (!specifier.startsWith(".")) return specifier;
  const target = path.posix.normalize(`services/server/${specifier}`);
  const moved = path.posix.relative(`entities/${registration}`, target);
  return moved.startsWith(".") ? moved : `./${moved}`;
}

/**
 * domainEntry.override.ts の本文 → 登録名ごとの entity.override.ts の本文。値の式に使う名前の import だけを持っていく
 * @param {string} text
 * @returns {{ files: Record<string, string>, problems: string[] }} files = 登録名 → 本文
 */
export function convertOverride(text) {
  const problems = [];
  let entries;
  try {
    entries = scanObjectEntries(text, "domainEntryOverrides").entries;
  } catch (error) {
    return { files: {}, problems: [`domainEntryOverrides が読めない(${error.message})`] };
  }
  const imports = [...text.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["'];?$/gm)].map((match) => ({
    typeOnly: Boolean(match[1]),
    names: match[2].split(",").map((name) => name.trim()).filter(Boolean),
    specifier: match[3],
  }));
  const files = {};
  for (const entry of entries) {
    const raw = text.slice(entry.start, entry.end).replace(/,\s*$/, "");
    const value = raw.slice(raw.indexOf(":") + 1).trim();
    const lines = ["// 上書き: 登録表 src/registry/serviceRegistry.ts のこの登録の行の access を丸ごと差し替える(点 entities、src/lib/domain/extensionPoints.ts)", "", 'import type { EntityOverride } from "@/lib/domain";'];
    for (const item of imports) {
      if (item.names.includes("DomainEntryOverrides")) continue;
      const used = item.names.filter((name) => new RegExp(`\\b${name.replace(/^type\s+/, "").split(/\s+as\s+/).pop()}\\b`).test(value));
      if (used.length > 0) lines.push(`import ${item.typeOnly ? "type " : ""}{ ${used.join(", ")} } from "${relocate(item.specifier, entry.key)}";`);
    }
    lines.push("", `export const ${OVERRIDE_EXPORT} = {`, `  apiAccess: ${value},`, "} satisfies EntityOverride;", "");
    files[entry.key] = lines.join("\n");
  }
  if (entries.length === 0) problems.push("domainEntryOverrides にキーが無い");
  return { files, problems };
}

/**
 * 宣言から作る行のうち、今の domainEntry.ts に無い物。比べるのは domainEntry.ts の残るドメインの行だけ:
 * domainEntry.ts の無いドメイン(core・上流の業務ドメイン・移し済みの登録)は宣言が正で、比べる相手が無い
 * @param {{ key: string, dir: string }[]} rows
 * @param {Set<string>} seen domainEntry.ts に出てきたキー
 * @param {string[]} entryFiles 残っている domainEntry.ts(src/domains/<dir>/services/server/domainEntry.ts)
 */
export function missingFromEntries(rows, seen, entryFiles) {
  const entryDirs = new Set(entryFiles.map((file) => file.slice("src/domains/".length, -`/${ENTRY_FILE}`.length)));
  return rows.filter((row) => entryDirs.has(row.dir) && !seen.has(row.key));
}

/** 登録表の比べる形 */
const rowOf = (row) => ({ table: row.table ?? null, idColumn: row.idColumn ?? null, access: row.access, requires: row.requires ?? [] });

async function main() {
  const repoRoot = process.cwd();
  const write = process.argv.includes("--write");
  const dirs = listDomainDirs(repoRoot);
  const entryFiles = dirs.map((dir) => `src/domains/${dir}/${ENTRY_FILE}`).filter((file) => fs.existsSync(path.join(repoRoot, file)));
  const overrideFiles = dirs.map((dir) => `src/domains/${dir}/${OLD_OVERRIDE_FILE}`).filter((file) => fs.existsSync(path.join(repoRoot, file)));
  if (entryFiles.length === 0 && overrideFiles.length === 0) {
    console.log("domainEntry.ts / domainEntry.override.ts は無い(移し済み)");
    return;
  }
  const stops = [];
  const { rows, errors } = discoverRegistrations(repoRoot);
  stops.push(...errors.map((error) => `宣言から登録表を作れない: ${error}`));
  const declared = new Map(rows.map((row) => [row.key, row]));
  const seen = new Set();
  for (const file of entryFiles) {
    const dir = file.slice("src/domains/".length, -`/${ENTRY_FILE}`.length);
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    const { domainEntries } = await import(pathToFileURL(path.join(repoRoot, file)).href);
    for (const [key, entry] of Object.entries(domainEntries)) {
      seen.add(key);
      const row = declared.get(key);
      if (!row) {
        stops.push(`${file}: キー ${key} の登録が宣言に無い(entities/${key}/entity.json が無いか registered: false)`);
        continue;
      }
      if (row.dir !== dir) stops.push(`${file}: キー ${key} の登録が別のドメイン ${row.dir} にある`);
      const service = new RegExp(`\\b${key}:\\s*\\{\\s*service:\\s*\\(\\)\\s*=>\\s*import\\("\\./([^"]+)"\\)\\.then\\(\\(m\\)\\s*=>\\s*m\\.(\\w+)\\)`).exec(text);
      if (!service) stops.push(`${file}: キー ${key} の service の字面が読めない(() => import("./<file>").then((m) => m.<export>) の形でない)`);
      else if (service[1] !== row.service.file || service[2] !== row.service.export) {
        stops.push(`${file}: キー ${key} の service: 今 ${service[1]}/${service[2]} / 宣言 ${row.service.file}/${row.service.export}(entity.json の service に { file, export })`);
      }
      if (!isDeepStrictEqual(rowOf(entry), rowOf(row))) stops.push(`${file}: キー ${key}: 今 ${JSON.stringify(rowOf(entry))} / 宣言 ${JSON.stringify(rowOf(row))}`);
    }
  }
  for (const row of missingFromEntries(rows, seen, entryFiles)) stops.push(`${row.entityPath}: 宣言から作る行 ${row.key} が今の domainEntry.ts に無い(登録表に出さない登録なら entity.json に "registered": false)`);
  const writes = {};
  for (const file of overrideFiles) {
    const domainRel = file.slice(0, -`/${OLD_OVERRIDE_FILE}`.length);
    const { files, problems } = convertOverride(fs.readFileSync(path.join(repoRoot, file), "utf8"));
    stops.push(...problems.map((problem) => `${file}: ${problem}`));
    for (const [registration, content] of Object.entries(files)) {
      const target = `${domainRel}/entities/${registration}/${OVERRIDE_FILE}`;
      if (!fs.existsSync(path.join(repoRoot, domainRel, "entities", registration, "entity.json"))) stops.push(`${file}: キー ${registration} の登録のフォルダ ${domainRel}/entities/${registration}/ が無い`);
      else if (fs.existsSync(path.join(repoRoot, target))) stops.push(`${target} が既にある(手で 1 つにまとめる)`);
      else writes[target] = content;
    }
  }
  if (stops.length > 0) {
    console.error(`✗ 止めました(${stops.length} 件。何も書いていない):\n${stops.map((stop) => `  - ${stop}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`登録表の行(domainEntry.ts の残るドメインの分)が今の domainEntry.ts と同じ。上書きの移し ${Object.keys(writes).length} 件、消す ${entryFiles.length + overrideFiles.length} 本`);
  for (const target of Object.keys(writes)) console.log(`  書く: ${target}`);
  for (const file of [...entryFiles, ...overrideFiles]) console.log(`  消す: ${file}`);
  if (!write) {
    console.log("計画だけ(--write で書く)");
    return;
  }
  for (const [target, content] of Object.entries(writes)) fs.writeFileSync(path.join(repoRoot, target), content);
  for (const file of [...entryFiles, ...overrideFiles]) fs.rmSync(path.join(repoRoot, file));
  console.log("✓ 書きました。続けて pnpm generate registry(登録表と集める入口)");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
