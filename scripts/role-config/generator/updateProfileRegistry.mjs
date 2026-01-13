// scripts/role-config/generator/updateProfileRegistry.mjs
// src/registry/profileTableRegistry.ts と profileBaseRegistry.ts の更新

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "src/registry");

/**
 * profileTableRegistry.ts を更新
 * アンカーコメント間に export 文を追加
 */
function updateProfileTables(roleConfig) {
  const filePath = path.join(REGISTRY_DIR, "profileTableRegistry.ts");
  let content = fs.readFileSync(filePath, "utf-8");

  const roleId = roleConfig.id;
  const entityFileName = `${toCamelCase(roleId)}Profile`;
  const exportLine = `export * from "@/features/core/userProfile/entities/${entityFileName}";`;

  // アンカーコメント間に追加
  const anchorStart = "// === AUTO-GENERATED EXPORTS START ===";
  const anchorEnd = "// === AUTO-GENERATED EXPORTS END ===";

  const startIndex = content.indexOf(anchorStart);
  const endIndex = content.indexOf(anchorEnd);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("profileTableRegistry.ts にアンカーコメントが見つかりません");
  }

  // 既存のエクスポートを取得
  const existingExports = content.slice(
    startIndex + anchorStart.length,
    endIndex
  );

  // 新しいエクスポートを追加
  const newExports = existingExports.trimEnd() + "\n" + exportLine + "\n";

  content =
    content.slice(0, startIndex + anchorStart.length) +
    newExports +
    content.slice(endIndex);

  fs.writeFileSync(filePath, content);
}

/**
 * profileBaseRegistry.ts を更新
 * アンカーコメント間に import 文とエントリを追加
 */
function updateProfileBases(roleConfig) {
  const filePath = path.join(REGISTRY_DIR, "profileBaseRegistry.ts");
  let content = fs.readFileSync(filePath, "utf-8");

  const roleId = roleConfig.id;
  const entityFileName = `${toCamelCase(roleId)}Profile`;
  const tableVar = `${toPascalCase(roleId)}ProfileTable`;

  // import 文を追加
  const importLine = `import { ${tableVar} } from "@/features/core/userProfile/entities/${entityFileName}";`;
  const importStart = "// === AUTO-GENERATED IMPORTS START ===";
  const importEnd = "// === AUTO-GENERATED IMPORTS END ===";

  let importStartIndex = content.indexOf(importStart);
  let importEndIndex = content.indexOf(importEnd);

  if (importStartIndex === -1 || importEndIndex === -1) {
    throw new Error("profileBaseRegistry.ts に import アンカーコメントが見つかりません");
  }

  const existingImports = content.slice(
    importStartIndex + importStart.length,
    importEndIndex
  );
  const newImports = existingImports.trimEnd() + "\n" + importLine + "\n";

  content =
    content.slice(0, importStartIndex + importStart.length) +
    newImports +
    content.slice(importEndIndex);

  // エントリを追加
  const entryLine = `  ${roleId}: createProfileBase(${tableVar}),`;
  const entryStart = "// === AUTO-GENERATED ENTRIES START ===";
  const entryEnd = "// === AUTO-GENERATED ENTRIES END ===";

  // content が更新されたので再度インデックスを取得
  const entryStartIndex = content.indexOf(entryStart);
  const entryEndIndex = content.indexOf(entryEnd);

  if (entryStartIndex === -1 || entryEndIndex === -1) {
    throw new Error("profileBaseRegistry.ts に entry アンカーコメントが見つかりません");
  }

  const existingEntries = content.slice(
    entryStartIndex + entryStart.length,
    entryEndIndex
  );
  const newEntries = existingEntries.trimEnd() + "\n" + entryLine + "\n  ";

  content =
    content.slice(0, entryStartIndex + entryStart.length) +
    newEntries +
    content.slice(entryEndIndex);

  fs.writeFileSync(filePath, content);
}

/**
 * registry を更新
 */
export function updateProfileRegistry(roleConfig) {
  updateProfileTables(roleConfig);
  updateProfileBases(roleConfig);
}
