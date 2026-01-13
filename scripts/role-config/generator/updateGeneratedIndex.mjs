// scripts/role-config/generator/updateGeneratedIndex.mjs
// generated/index.ts の生成・更新

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

/**
 * generated/index.ts を生成・更新
 * generated/ 配下のサブフォルダをすべてエクスポート
 */
export function updateGeneratedIndex() {
  // generated/ フォルダが存在しない場合は作成
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // サブフォルダを取得（index.ts 以外のディレクトリ）
  const entries = fs.readdirSync(GENERATED_DIR, { withFileTypes: true });
  const roleDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const exports = roleDirs.map((roleId) => `export * from "./${roleId}";`);

  const content = `// src/features/core/userProfile/generated/index.ts
// 全プロフィールのエクスポート
//
// このファイルは role:generate スクリプトによって自動生成されました

${exports.length > 0 ? exports.join("\n") : "// プロフィールなし"}
`;

  const filePath = path.join(GENERATED_DIR, "index.ts");
  fs.writeFileSync(filePath, content);
}
