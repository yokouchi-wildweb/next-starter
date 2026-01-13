// scripts/role-config/generator/generateProfileForm.mjs
// generated/{roleId}/form.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/generated"
);

/**
 * generated/{roleId}/form.ts を生成
 */
export function generateProfileForm(roleConfig, profileConfig) {
  const roleId = roleConfig.id;
  const rolePascal = toPascalCase(roleId);

  const content = `// src/features/core/userProfile/generated/${roleId}/form.ts
// ${roleConfig.label}プロフィールのフォーム型定義
//
// 元情報: src/features/core/userProfile/profiles/${roleId}.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { z } from "zod";
import { ${rolePascal}ProfileSchema } from "./schema";

/**
 * ${roleConfig.label}プロフィールのフォーム追加フィールド
 */
export type ${rolePascal}ProfileAdditional = {
  // foo: string; // フォームに追加する項目
};

/**
 * ${roleConfig.label}プロフィールのフォームフィールド型
 */
export type ${rolePascal}ProfileFields = z.infer<typeof ${rolePascal}ProfileSchema> & ${rolePascal}ProfileAdditional;
`;

  const roleDir = path.join(GENERATED_DIR, roleId);
  if (!fs.existsSync(roleDir)) {
    fs.mkdirSync(roleDir, { recursive: true });
  }

  const filePath = path.join(roleDir, "form.ts");
  fs.writeFileSync(filePath, content);
}
