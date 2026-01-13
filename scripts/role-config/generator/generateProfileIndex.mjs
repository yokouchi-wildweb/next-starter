// scripts/role-config/generator/generateProfileIndex.mjs
// generated/{roleId}/index.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

/**
 * generated/{roleId}/index.ts を生成
 */
export function generateProfileIndex(roleConfig, profileConfig, hasFieldConstants = false) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  const exports = [
    `export * from "./drizzle";`,
    `export * from "./schema";`,
    `export * from "./form";`,
    `export * from "./model";`,
    `export * from "./presenters";`,
  ];

  if (hasFieldConstants) {
    exports.push(`export * from "./fieldConstants";`);
  }

  const content = `// src/features/core/userProfile/generated/${roleId}/index.ts
// ${roleConfig.label}プロフィールのエクスポート
//
// このファイルは role:generate スクリプトによって自動生成されました

${exports.join("\n")}
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "index.ts");
  fs.writeFileSync(filePath, content);
}
