// scripts/role-config/generator/updateRoleRegistry.mjs
// src/registry/roleRegistry.ts の更新

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const ROLE_REGISTRY_PATH = path.join(ROOT_DIR, "src/registry/roleRegistry.ts");

/**
 * roleRegistry.ts にロールを追加
 *
 * 処理:
 * 1. import 文を追加（AUTO-GENERATED IMPORTS 内）
 * 2. ALL_ROLES 配列に追加（AUTO-GENERATED ENTRIES 内）
 */
export function updateRoleRegistry(roleConfig) {
  let content = fs.readFileSync(ROLE_REGISTRY_PATH, "utf-8");
  const roleId = roleConfig.id;
  const varName = `${toCamelCase(roleId)}Role`;

  // 1. import 文を追加
  const importLine = `import ${varName} from "@/features/core/user/roles/${roleId}.role.json";`;
  const importStart = "// === AUTO-GENERATED IMPORTS START ===";
  const importEnd = "// === AUTO-GENERATED IMPORTS END ===";

  const importStartIndex = content.indexOf(importStart);
  const importEndIndex = content.indexOf(importEnd);

  if (importStartIndex === -1 || importEndIndex === -1) {
    throw new Error("roleRegistry.ts に import アンカーコメントが見つかりません");
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

  // 2. ALL_ROLES 配列に追加
  const entryLine = `  ${varName} as RoleConfig,`;
  const entryStart = "// === AUTO-GENERATED ENTRIES START ===";
  const entryEnd = "// === AUTO-GENERATED ENTRIES END ===";

  // content が更新されたので再度インデックスを取得
  const entryStartIndex = content.indexOf(entryStart);
  const entryEndIndex = content.indexOf(entryEnd);

  if (entryStartIndex === -1 || entryEndIndex === -1) {
    throw new Error("roleRegistry.ts に entry アンカーコメントが見つかりません");
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

  fs.writeFileSync(ROLE_REGISTRY_PATH, content);
}
