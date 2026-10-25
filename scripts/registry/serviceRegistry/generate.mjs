#!/usr/bin/env node
// scripts/registry/serviceRegistry/generate.mjs
// src/registry/serviceRegistry.ts を src/features/**/services/server/domainEntry.ts（+ domainEntry.override.ts）から丸ごと生成する
//
// 使い方:
//   pnpm registry:generate            # 生成して書き出す（dc:generate / dc:delete の最後にも自動で走る）
//   pnpm registry:check               # 生成せず一致を検査（./check.mjs。ビルドの冒頭と test でも走る）
//
// 書き出さず失敗する条件（./check.mjs の静的検査と同じ。キーと直し方を出す）:
// - 移行前の手書き行（どの domainEntry.ts からも作られないキー）が、生成ヘッダの無い既存の serviceRegistry.ts にある
// - キーの重複 / drizzleBase.ts・firestoreBase.ts があるのに domainEntry.ts が無い（例外表 ENTRY_EXCEPTIONS を除く）
// - storageBindingFor の第 1 引数（record_type）がキーに無い / domainEntry.ts が読めない・許可外の静的 import
// 生成ヘッダ付きの既存ファイルから消えるキー（dc:delete 後）は正当な除去として通す。
// 詳細: src/lib/domain/README.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ENTRY_EXCEPTIONS,
  ENTRY_FILE,
  GENERATED_HEADER,
  OVERRIDE_FILE,
  REGISTRY_FILE,
  discoverDomainEntries,
  listStorageBindingRecordTypes,
  readExistingRegistry,
} from "./discover.mjs";

/** 移行前の手書き行の移し先を案内する */
function legacyKeyHint(repoRoot, key, serviceImports) {
  const features = path.join(repoRoot, "src", "features");
  // 旧 import の変数名（xService / xBase）からドメインのディレクトリを引く
  const importedDir = [...serviceImports.entries()].find(([name]) => name.toLowerCase().startsWith(key.toLowerCase()))?.[1];
  // 旧 import は tsconfig の別名（@/features/user = core/user）で書かれていることがあるので core/ も探す
  const candidates = [importedDir, importedDir && `core/${importedDir}`, key, `core/${key}`].filter(Boolean);
  const dir = candidates.find((candidate) => fs.existsSync(path.join(features, candidate))) ?? key;
  if (!fs.existsSync(path.join(features, dir))) {
    return `対応するドメインが見つからない。fork が core パスに作ったドメインなら src/features/core/<domain>/services/server/${ENTRY_FILE} を手書きする（access を変えるだけなら ${OVERRIDE_FILE}）`;
  }
  if (!dir.startsWith("core/") && fs.existsSync(path.join(features, dir, "domain.json"))) {
    return `access は domain.json の apiAccess に移し、pnpm dc:generate ${key} --yes --only registry で src/features/${dir}/services/server/${ENTRY_FILE} を生成する`;
  }
  return `src/features/${dir}/services/server/${ENTRY_FILE} を手書きする（core の access を fork で変えるなら隣に ${OVERRIDE_FILE}）`;
}

/**
 * 生成物のテキストと検査結果を作る（ファイルは書かない）
 * @returns {{ text: string, errors: string[], keys: string[], domains: import("./discover.mjs").DomainEntryInfo[] }}
 */
export function buildServiceRegistry(repoRoot) {
  const domains = discoverDomainEntries(repoRoot);
  const errors = [];
  const keyOwners = new Map();

  for (const domain of domains) {
    errors.push(...domain.entryErrors, ...domain.overrideErrors);
    if (!domain.entryPath && domain.hasBase && !(domain.dir in ENTRY_EXCEPTIONS)) {
      errors.push(
        `src/features/${domain.dir}/services/server に drizzleBase.ts / firestoreBase.ts があるのに ${ENTRY_FILE} が無い` +
          (domain.hasDomainJson && !domain.isCore
            ? `（pnpm dc:generate ${domain.camel} --yes --only registry で生成する）`
            : `（手書きする。登録表に載せないドメインは scripts/registry/serviceRegistry/discover.mjs の ENTRY_EXCEPTIONS に理由付きで書く）`),
      );
    }
    if (domain.entryPath && domain.keys.length === 0 && domain.entryErrors.length === 0) {
      errors.push(`${domain.entryPath}: キーが 1 つも無い`);
    }
    for (const key of domain.keys) {
      if (keyOwners.has(key)) {
        errors.push(`キー "${key}" が重複している: ${keyOwners.get(key)} と ${domain.entryPath}`);
      } else {
        keyOwners.set(key, domain.entryPath);
      }
    }
  }
  for (const [dir, reason] of Object.entries(ENTRY_EXCEPTIONS)) {
    const domain = domains.find((item) => item.dir === dir);
    if (!domain || !domain.hasBase || domain.entryPath) {
      errors.push(`ENTRY_EXCEPTIONS の "${dir}"（${reason}）は不要になった（drizzleBase が無い・domainEntry.ts がある・ドメインが無い）。行を消す`);
    }
  }

  for (const { recordType, file } of listStorageBindingRecordTypes(repoRoot)) {
    if (!keyOwners.has(recordType)) {
      errors.push(`${file}: storageBindingFor("${recordType}") の record_type が登録表のキーに無い（${ENTRY_FILE} のキーと一致させる）`);
    }
  }

  const existing = readExistingRegistry(repoRoot);
  if (existing) {
    if (existing.error) errors.push(`${REGISTRY_FILE}: ${existing.error}`);
    if (!existing.generated) {
      const legacy = existing.keys.filter((key) => !keyOwners.has(key));
      for (const key of legacy) {
        errors.push(`${REGISTRY_FILE}: 手書きの行 "${key}" はどの ${ENTRY_FILE} からも作られない → ${legacyKeyHint(repoRoot, key, existing.serviceImports)}`);
      }
    }
  }

  // 並び: core → 業務、ディレクトリ名順。alias は <camel>Entries（衝突時は番号を足す）
  const ordered = [...domains]
    .filter((domain) => domain.entryPath)
    .sort((a, b) => (a.isCore !== b.isCore ? (a.isCore ? -1 : 1) : a.dir.localeCompare(b.dir)));
  const aliases = new Map();
  const usedAliases = new Set();
  for (const domain of ordered) {
    let alias = `${domain.camel}Entries`;
    for (let i = 2; usedAliases.has(alias); i++) alias = `${domain.camel}Entries${i}`;
    usedAliases.add(alias);
    aliases.set(domain, alias);
  }

  const lines = [
    GENERATED_HEADER,
    `// ${REGISTRY_FILE}`,
    "//",
    "// ドメイン名からサービス・表・主キーを引く正式な仕組み（登録表）。ドメインを 1 つ作ると行が増える一覧で、",
    "// 下流が中身を足す登録口ではない。新しい用途で独自の対応表を作らず、この表を引く（src/wiring/domains.ts の getService 系）。",
    "// - 業務ドメイン: dc:generate が domain.json から domainEntry.ts を生成 → この表に載る",
    "// - core ドメイン・fork が core パスに作るドメイン: domainEntry.ts を手書き",
    `// - fork が core の access を変える: 隣に ${OVERRIDE_FILE}（fork 所有、access だけ）`,
    "// サービスは遅延読み込み（この表を import しても各ドメインのサービス・DB 接続は読み込まれない）。",
    "// 検査: pnpm registry:check / 詳細: src/lib/domain/README.md",
    "",
    'import type { DomainRegistry } from "@/lib/domain/types";',
    "",
  ];
  for (const domain of ordered) {
    lines.push(`import { domainEntries as ${aliases.get(domain)} } from "${domain.importPath}";`);
  }
  const overridden = ordered.filter((domain) => domain.overridePath);
  if (overridden.length > 0) {
    lines.push("");
    for (const domain of overridden) {
      lines.push(`import { domainEntryOverrides as ${aliases.get(domain)}Overrides } from "${domain.overrideImportPath}";`);
    }
  }
  lines.push("", "export const serviceRegistry: DomainRegistry = {");
  for (const domain of ordered) {
    const alias = aliases.get(domain);
    for (const key of domain.keys) {
      if (domain.overrideKeys.includes(key)) {
        lines.push(`  ${key}: { service: ${alias}.${key}.service, access: ${alias}Overrides.${key} },`);
      } else {
        lines.push(`  ${key}: ${alias}.${key},`);
      }
    }
  }
  lines.push("};", "");

  return { text: lines.join("\n"), errors, keys: [...keyOwners.keys()], domains };
}

/**
 * serviceRegistry.ts を生成して書き出す。検査に失敗したら書かずに throw
 * @returns {{ written: boolean, added: string[], removed: string[] }}
 */
export function generateServiceRegistry(repoRoot, { log = console.log } = {}) {
  const { text, errors, keys } = buildServiceRegistry(repoRoot);
  if (errors.length > 0) {
    throw new Error(`${REGISTRY_FILE} を生成できません:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
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
  log(`${written ? "✓ 生成しました" : "✓ 変更なし"}: ${REGISTRY_FILE}（${keys.length} キー）`);
  if (existing?.generated) {
    if (added.length > 0) log(`  追加: ${added.join(", ")}`);
    if (removed.length > 0) log(`  除去: ${removed.join(", ")}`);
  }
  return { written, added, removed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  try {
    generateServiceRegistry(repoRoot);
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
