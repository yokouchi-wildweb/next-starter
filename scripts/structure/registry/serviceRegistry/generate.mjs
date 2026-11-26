#!/usr/bin/env node
// scripts/structure/registry/serviceRegistry/generate.mjs
// src/registry/serviceRegistry.ts を登録の宣言(src/domains/**/entities/<登録名>/entity.json)と fork の上書き(隣の entity.override.ts)から丸ごと生成する(D336)
//
// 使い方:
//   pnpm generate registry            # 生成して書き出す(pnpm generate domain / pnpm generate domain -- --delete の最後にも自動で走る)
//   pnpm check registry               # 生成せず一致を検査(./check.mjs。ビルドの冒頭と test でも走る)
//
// 行 = registered が false でない登録 1 件: キー = 登録名、service = entity.json の service か既定 <登録名>Service(services/server/ の遅延読み込み)、
// table = entity.table か snake(plural)(Firestore は null)、idColumn = 主キーの 1 列か id、access = ./access.mjs の accessOfDeclaration、requires。
// 書き出さず失敗する条件(./check.mjs の静的検査と同じ。キーと直し方を出す): 登録名・表の重なり / サービスのファイルが無い /
// 登録の無い <名前>Base.ts / storageBindingFor の第 1 引数(record_type)がキーに無い / 上書きが読めない・許可外の静的 import /
// 生成物の印の無い(手書きの)serviceRegistry.ts。詳細: src/lib/domain/README.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PRESET_MODULE, serializeAccess } from "./access.mjs";
import { GENERATED_HEADER, OVERRIDE_EXPORT, OVERRIDE_FILE, REGISTRY_FILE, discoverRegistrations, listStorageBindingRecordTypes, overrideAttribute, readExistingRegistry } from "./discover.mjs";

/**
 * 生成物のテキストと検査結果を作る(ファイルは書かない)
 * @param {string} repoRoot
 * @param {{ view?: import("./discover.mjs").FileView }} [options] view = ファイルの見え方。pnpm generate domain が「これから書く
 *   サービス・<登録名>Base.ts」を重ねて渡し、書く前に検査する(createOverlayView)
 * @returns {{ text: string, errors: string[], keys: string[], rows: import("./discover.mjs").RegistryRow[] }}
 */
export function buildServiceRegistry(repoRoot, { view } = {}) {
  const { rows, errors } = discoverRegistrations(repoRoot, view);
  const keys = rows.map((row) => row.key);

  for (const { recordType, file } of listStorageBindingRecordTypes(repoRoot)) {
    if (!keys.includes(recordType)) {
      errors.push(`${file}: storageBindingFor("${recordType}") の record_type が登録表のキーに無い(登録名と一致させる)`);
    }
  }

  const existing = readExistingRegistry(repoRoot);
  if (existing) {
    if (existing.error) errors.push(`${REGISTRY_FILE}: ${existing.error}`);
    if (!existing.generated) errors.push(`${REGISTRY_FILE}: 生成物の印が無い(手書きの登録表)。行は登録の entity.json に移し(fork が core の access を変えるなら ${OVERRIDE_FILE})、消してから pnpm generate registry`);
  }

  // 並び: core → 業務、ドメインのフォルダ名順、ドメインの中は登録のフォルダの並び
  const ordered = [...rows].sort((a, b) => (a.isCore !== b.isCore ? (a.isCore ? -1 : 1) : a.dir.localeCompare(b.dir)));
  const overridden = ordered.filter((row) => row.overridePath);
  const attribute = overridden.length > 0 ? overrideAttribute() : null;
  const presets = new Set();
  const body = [];
  for (const row of ordered) {
    body.push(`  ${row.key}: {`, `    service: () => import("${row.serviceImport}").then((m) => m.${row.service.export}),`);
    body.push(`    table: ${JSON.stringify(row.table)},`, `    idColumn: ${JSON.stringify(row.idColumn)},`);
    if (row.overridePath) {
      body.push(`    access: ${row.key}Override.${attribute},`);
    } else {
      const { lines, names } = serializeAccess(row.access);
      for (const name of names) presets.add(name);
      body.push("    access: {", ...lines.map((line) => `      ${line}`), "    },");
    }
    if (row.requires.length > 0) body.push(`    requires: ${JSON.stringify(row.requires)},`);
    body.push("  },");
  }

  const lines = [
    GENERATED_HEADER,
    `// ${REGISTRY_FILE}`,
    "//",
    "// 登録名からサービス・表・主キー・権限を引く正式な仕組み(登録表)。登録(entities/<登録名>/entity.json)を 1 つ足すと行が増える一覧で、",
    "// 下流が中身を足す登録口ではない。新しい用途で独自の対応表を作らず、この表を引く(src/wiring/domainRegistry.ts の getService 系)。",
    "// - 行 = registered が false でない登録。access は entity.json の apiAccess / useImportExport から(手で持つ登録 generate:false は apiAccess のまま)",
    `// - fork が core の access を変える: 登録のフォルダに ${OVERRIDE_FILE}(fork 所有、export const ${OVERRIDE_EXPORT} = { apiAccess })`,
    "// サービスは遅延読み込み(この表を import しても各ドメインのサービス・DB 接続は読み込まれない)。",
    "// 検査: pnpm check registry / 詳細: src/lib/domain/README.md",
    "",
    'import type { DomainRegistry } from "@/lib/domain";',
  ];
  if (presets.size > 0) lines.push(`import { ${[...presets].sort().join(", ")} } from "${PRESET_MODULE}";`);
  if (overridden.length > 0) {
    lines.push("");
    for (const row of overridden) lines.push(`import { ${OVERRIDE_EXPORT} as ${row.key}Override } from "${row.overrideImport}";`);
  }
  lines.push("", "export const serviceRegistry: DomainRegistry = {", ...body, "};", "");

  return { text: lines.join("\n"), errors, keys, rows };
}

/** 検査エラーの文面(pnpm generate domain の書く前の検査も同じ文面を出す) */
export function formatRegistryErrors(errors) {
  return `${REGISTRY_FILE} を生成できません:\n${errors.map((error) => `  - ${error}`).join("\n")}`;
}

/**
 * serviceRegistry.ts を生成して書き出す。検査に失敗したら書かずに throw
 * @returns {{ written: boolean, added: string[], removed: string[] }}
 */
export function generateServiceRegistry(repoRoot, { log = console.log } = {}) {
  const { text, errors, keys } = buildServiceRegistry(repoRoot);
  if (errors.length > 0) {
    throw new Error(formatRegistryErrors(errors));
  }
  const existing = readExistingRegistry(repoRoot);
  const before = new Set(existing?.generated ? existing.keys : []);
  const added = keys.filter((key) => !before.has(key));
  const removed = [...before].filter((key) => !keys.includes(key));
  const file = path.join(repoRoot, REGISTRY_FILE);
  const written = existing?.text !== text;
  if (written) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  log(`${written ? "✓ 生成しました" : "✓ 変更なし"}: ${REGISTRY_FILE}(${keys.length} キー)`);
  if (existing?.generated) {
    if (added.length > 0) log(`  追加: ${added.join(", ")}`);
    if (removed.length > 0) log(`  除去: ${removed.join(", ")}`);
  }
  return { written, added, removed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  try {
    generateServiceRegistry(repoRoot);
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
