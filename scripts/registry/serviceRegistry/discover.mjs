// scripts/registry/serviceRegistry/discover.mjs
// src/features/**/services/server/domainEntry.ts（と fork の domainEntry.override.ts）を走査し、
// src/registry/serviceRegistry.ts の生成・検査に必要な情報を集める（一覧ファイルは持たない）。
//
// 利用者: ./generate.mjs（pnpm registry:generate）, ./check.mjs（pnpm registry:check）,
//         ./serviceRegistry.test.mjs（pnpm test:service-registry）, scripts/domain-config（dc:generate / dc:delete の最後）
// TS を実行せずテキストで読む（キーの一覧・import 行）。plain node で動くので dc:generate から直接呼べる。
// サービスを実際に読み込む検査はテスト側（tsx）。

import fs from "node:fs";
import path from "node:path";

import { scanObjectEntries } from "../../domain-config/text/objectEntry.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

export const ENTRY_FILE = "domainEntry.ts";
export const OVERRIDE_FILE = "domainEntry.override.ts";
export const ENTRIES_EXPORT = "domainEntries";
export const OVERRIDES_EXPORT = "domainEntryOverrides";
export const REGISTRY_FILE = "src/registry/serviceRegistry.ts";
/** 生成物の 1 行目（この行が無いファイル = 移行前の手書き登録表） */
export const GENERATED_HEADER = "// 生成物・編集不可: pnpm registry:generate が src/features/**/services/server/domainEntry.ts から生成する";

/** domainEntry.ts / domainEntry.override.ts が静的 import してよいモジュール */
export const ALLOWED_STATIC_IMPORTS = ["@/lib/domain/types", "@/config/app/domain-api-access.config"];

/**
 * drizzleBase.ts / firestoreBase.ts があるのに domainEntry.ts を持たなくてよいドメイン（features 相対のディレクトリ名）。
 * 縮むだけの例外表: 行を足すのは新しいドメインを登録表から意図して外すときだけで、理由を書く。
 */
export const ENTRY_EXCEPTIONS = {};

/** `src/features/<dir>` または `src/features/core/<dir>` の一覧（`_` 始まりは雛形なので除く） */
export function listDomainDirs(repoRoot) {
  const featuresDir = path.join(repoRoot, "src", "features");
  const result = [];
  const visit = (base, prefix) => {
    if (!fs.existsSync(base)) return;
    for (const dirent of fs.readdirSync(base, { withFileTypes: true })) {
      if (!dirent.isDirectory() || dirent.name.startsWith("_")) continue;
      if (prefix === "" && dirent.name === "core") {
        visit(path.join(base, "core"), "core/");
        continue;
      }
      result.push(`${prefix}${dirent.name}`);
    }
  };
  visit(featuresDir, "");
  return result.sort();
}

/** 文字列・コメントを除いたテキスト（import 行や識別子の検出用） */
function stripComments(text) {
  // 行コメントを先に消す（`/api/<domain>/**` のような行コメント内の `/**` をブロックコメントの開始と誤認しないため）
  return text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 静的 import 文の from 先（`import type` を含む。動的 import() は含まない） */
export function listStaticImports(text) {
  const sources = [];
  for (const match of stripComments(text).matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)) {
    sources.push(match[1]);
  }
  for (const match of stripComments(text).matchAll(/^\s*import\s*["']([^"']+)["']/gm)) {
    sources.push(match[1]);
  }
  return sources;
}

/** `export const <name> = {` 直下のキー一覧。無い・壊れていれば error */
export function readObjectKeys(text, exportName) {
  if (!new RegExp(`export\\s+const\\s+${exportName}\\b`).test(text)) {
    return { keys: null, error: `export const ${exportName} が無い` };
  }
  try {
    return { keys: scanObjectEntries(text, exportName).entries.map((entry) => entry.key), error: null };
  } catch (error) {
    return { keys: null, error: error.message };
  }
}

/** 登録の table / idColumn に書ける値（PostgreSQL の識別子の上限 63 文字。値の正しさは test:service-registry が実物と比べる） */
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * 1 キーの値（オブジェクトリテラル）の直下の項目を { name: 値の文字列 } で返す。オブジェクトでなければ null
 * @param {string} valueText `{ service: ..., table: "x", ... }`
 */
function readEntryFields(valueText) {
  const trimmed = valueText.trim().replace(/,$/, "");
  if (!trimmed.startsWith("{")) return null;
  const text = `const __entry = ${trimmed}`;
  const fields = {};
  for (const entry of scanObjectEntries(text, "__entry").entries) {
    const raw = text.slice(entry.start, entry.end).replace(/,$/, "");
    fields[entry.key] = raw.slice(raw.indexOf(":") + 1).replace(/^\s*(\/\/[^\n]*\n\s*)*/, "").trim();
  }
  return fields;
}

/** `"x"` / `'x'` → x、`null` → null、それ以外（定数・式・無し）→ undefined */
function readLiteral(raw) {
  if (raw === undefined) return undefined;
  const value = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*$/gm, "").trim();
  if (value === "null") return null;
  const match = /^(["'])([^"'\\]*)\1$/.exec(value);
  return match ? match[2] : undefined;
}

/**
 * domainEntry.ts の各キーの table / idColumn（D57）を読み、形の誤りを errors に積む。
 * 受け付けるのは文字列リテラルか null だけ（生成器はファイルを文字として読むので、定数・式は読めない）。
 * @returns {{ tables: Record<string, { table: string | null, idColumn: string | null }>, errors: string[] }}
 */
export function readEntryTables(text, entryPath) {
  const tables = {};
  const errors = [];
  for (const entry of scanObjectEntries(text, ENTRIES_EXPORT).entries) {
    const raw = text.slice(entry.start, entry.end);
    const fields = readEntryFields(raw.slice(raw.indexOf(":") + 1));
    const where = `${entryPath}: キー "${entry.key}"`;
    if (!fields) {
      errors.push(`${where} の値がオブジェクトリテラルでない（table / idColumn を読めない）`);
      continue;
    }
    const values = {};
    for (const name of ["table", "idColumn"]) {
      if (!(name in fields)) {
        errors.push(
          `${where} に ${name} が無い（生成ドメインは pnpm dc:generate <domain> --yes --only registry、手書きは service の直後に ` +
            `table: "<表の物理名>", idColumn: "id" を書く。表を持たない Firestore 版は両方 null）`,
        );
        continue;
      }
      const value = readLiteral(fields[name]);
      if (value === undefined) {
        errors.push(`${where} の ${name} は文字列リテラルか null で書く（定数・式は読めない）: ${fields[name]}`);
        continue;
      }
      if (value !== null && (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH || /[\s"'`]/.test(value))) {
        errors.push(`${where} の ${name} "${value}" は表・列の物理名の形でない（空でない・${MAX_IDENTIFIER_LENGTH} 文字以内・引用符と空白を含まない）`);
        continue;
      }
      values[name] = value;
    }
    if (!("table" in values) || !("idColumn" in values)) continue;
    if ((values.table === null) !== (values.idColumn === null)) {
      errors.push(`${where} の table と idColumn は両方 null（表を持たない Firestore 版）か両方文字列にする`);
      continue;
    }
    tables[entry.key] = { table: values.table, idColumn: values.idColumn };
  }
  return { tables, errors };
}

/**
 * 1 ドメイン分の情報
 * @typedef {{
 *   dir: string, camel: string, isCore: boolean,
 *   entryPath: string | null, importPath: string | null, keys: string[], entryErrors: string[],
 *   tables: Record<string, { table: string | null, idColumn: string | null }>,
 *   overridePath: string | null, overrideImportPath: string | null, overrideKeys: string[], overrideErrors: string[],
 *   hasBase: boolean, hasDomainJson: boolean,
 * }} DomainEntryInfo
 */

/**
 * ファイルの見え方。既定はディスクそのまま。dc:generate は「これから書くファイル」を重ねた見え方で、
 * 書く前に登録表の検査を通す（createOverlayView）
 * @typedef {{ exists: (file: string) => boolean, read: (file: string) => string }} FileView
 */
/** 空白とコメントだけのソースか */
export const isBlankSource = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

export const diskView = { exists: (file) => fs.existsSync(file), read: (file) => fs.readFileSync(file, "utf8") };

/**
 * @param {Map<string, string | null>} overlay 絶対パス → これから書く内容（null = 消える）。無いパスはディスクを見る
 * @returns {FileView}
 */
export function createOverlayView(overlay) {
  return {
    exists: (file) => (overlay.has(file) ? overlay.get(file) !== null : fs.existsSync(file)),
    read: (file) => (overlay.has(file) ? overlay.get(file) : fs.readFileSync(file, "utf8")),
  };
}

/**
 * domainEntry.ts / override / drizzleBase / firestoreBase の有無とキーを集める
 * @param {string} repoRoot
 * @param {FileView} [view] ファイルの見え方（既定 = ディスク）
 */
export function discoverDomainEntries(repoRoot, view = diskView) {
  /** @type {DomainEntryInfo[]} */
  const domains = [];
  for (const dir of listDomainDirs(repoRoot)) {
    const serverDir = path.join(repoRoot, "src", "features", dir, "services", "server");
    const entryFile = path.join(serverDir, ENTRY_FILE);
    const overrideFile = path.join(serverDir, OVERRIDE_FILE);
    const hasBase = view.exists(path.join(serverDir, "drizzleBase.ts")) || view.exists(path.join(serverDir, "firestoreBase.ts"));
    const hasDomainJson = view.exists(path.join(repoRoot, "src", "features", dir, "domain.json"));
    const camel = toCamelCase(path.basename(dir)) || path.basename(dir);
    const info = {
      dir,
      camel,
      isCore: dir.startsWith("core/"),
      entryPath: null,
      importPath: null,
      keys: [],
      entryErrors: [],
      tables: {},
      overridePath: null,
      overrideImportPath: null,
      overrideKeys: [],
      overrideErrors: [],
      hasBase,
      hasDomainJson,
    };
    const rel = `src/features/${dir}/services/server`;
    if (view.exists(entryFile)) {
      info.entryPath = `${rel}/${ENTRY_FILE}`;
      info.importPath = `@/features/${dir}/services/server/domainEntry`;
      const text = view.read(entryFile);
      const { keys, error } = readObjectKeys(text, ENTRIES_EXPORT);
      if (error) info.entryErrors.push(`${info.entryPath}: ${error}`);
      else {
        info.keys = keys;
        const read = readEntryTables(text, info.entryPath);
        info.tables = read.tables;
        info.entryErrors.push(...read.errors);
      }
      for (const source of listStaticImports(text)) {
        if (!ALLOWED_STATIC_IMPORTS.includes(source)) {
          info.entryErrors.push(
            `${info.entryPath}: "${source}" を静的 import している（許可: ${ALLOWED_STATIC_IMPORTS.join(", ")}。サービスは service: () => import(...) で遅延読み込みにする）`,
          );
        }
      }
    }
    // 空(空白とコメントだけ)の上書きは不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)
    if (view.exists(overrideFile) && !isBlankSource(view.read(overrideFile))) {
      info.overridePath = `${rel}/${OVERRIDE_FILE}`;
      info.overrideImportPath = `@/features/${dir}/services/server/domainEntry.override`;
      const text = view.read(overrideFile);
      const { keys, error } = readObjectKeys(text, OVERRIDES_EXPORT);
      if (error) info.overrideErrors.push(`${info.overridePath}: ${error}`);
      else info.overrideKeys = keys;
      for (const source of listStaticImports(text)) {
        if (!ALLOWED_STATIC_IMPORTS.includes(source)) {
          info.overrideErrors.push(`${info.overridePath}: "${source}" を静的 import している（許可: ${ALLOWED_STATIC_IMPORTS.join(", ")}）`);
        }
      }
      if (!info.entryPath) {
        info.overrideErrors.push(`${info.overridePath}: 隣に ${ENTRY_FILE} が無い（上書きだけでは登録できない）`);
      } else {
        for (const key of info.overrideKeys) {
          if (!info.keys.includes(key)) {
            info.overrideErrors.push(`${info.overridePath}: キー "${key}" は隣の ${ENTRY_FILE} に無い`);
          }
        }
      }
    }
    domains.push(info);
  }
  return domains;
}

/** src/ 配下（*.test.* を除く）の storageBindingFor("<record_type>", ...) の第 1 引数とファイル */
export function listStorageBindingRecordTypes(repoRoot) {
  const result = [];
  const walk = (dir) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|mts)$/.test(dirent.name) || /\.test\./.test(dirent.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      if (!text.includes("storageBindingFor(")) continue;
      for (const match of stripComments(text).matchAll(/storageBindingFor\(\s*["']([^"']+)["']/g)) {
        result.push({ recordType: match[1], file: path.relative(repoRoot, full).split(path.sep).join("/") });
      }
    }
  };
  walk(path.join(repoRoot, "src"));
  return result;
}

/** 既存の serviceRegistry.ts の情報（無ければ null） */
export function readExistingRegistry(repoRoot) {
  const file = path.join(repoRoot, REGISTRY_FILE);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const generated = text.split(/\r?\n/)[0] === GENERATED_HEADER;
  const { keys, error } = readObjectKeys(text, "serviceRegistry");
  // 旧形式: `import { xService } from "@/features/.../services/server/xService"` からキー → ドメインを推定（移し先の案内に使う）
  const serviceImports = new Map();
  for (const match of text.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*["']@\/features\/((?:core\/)?[\w-]+)\/services\/server[^"']*["']/g)) {
    serviceImports.set(match[1], match[2]);
  }
  return { text, generated, keys: keys ?? [], error, serviceImports };
}
