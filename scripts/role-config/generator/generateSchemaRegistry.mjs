// scripts/role-config/generator/generateSchemaRegistry.mjs
// profileSchemaRegistry.ts と profileSchemaHelpers.ts の生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "src/registry");
const PROFILES_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/profiles"
);

/**
 * 全プロフィール設定を取得
 */
function getAllProfiles() {
  if (!fs.existsSync(PROFILES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PROFILES_DIR);
  return files
    .filter((file) => file.endsWith(".profile.json"))
    .map((file) => {
      const roleId = file.replace(".profile.json", "");
      return { roleId };
    });
}

/**
 * src/registry/profileSchemaRegistry.ts を生成
 */
function generateProfileSchemaRegistry(profiles) {
  if (profiles.length === 0) {
    const content = `// src/registry/profileSchemaRegistry.ts
// プロフィールスキーマのレジストリ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました

import type { z } from "zod";

/**
 * ロール → プロフィールスキーマのマッピング
 */
export const PROFILE_SCHEMA_REGISTRY: Record<string, z.ZodType> = {};
`;
    fs.writeFileSync(path.join(REGISTRY_DIR, "profileSchemaRegistry.ts"), content);
    return;
  }

  // import 文を生成
  const imports = profiles
    .map(({ roleId }) => {
      const pascalCase = toPascalCase(roleId);
      return `import { ${pascalCase}ProfileSchema } from "@/features/core/userProfile/generated/${roleId}";`;
    })
    .join("\n");

  // レジストリエントリを生成
  const entries = profiles
    .map(({ roleId }) => {
      const pascalCase = toPascalCase(roleId);
      return `  ${roleId}: ${pascalCase}ProfileSchema,`;
    })
    .join("\n");

  const content = `// src/registry/profileSchemaRegistry.ts
// プロフィールスキーマのレジストリ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました

import type { z } from "zod";
${imports}

/**
 * ロール → プロフィールスキーマのマッピング
 */
export const PROFILE_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
${entries}
};
`;

  fs.writeFileSync(path.join(REGISTRY_DIR, "profileSchemaRegistry.ts"), content);
}

/**
 * スキーマレジストリを生成
 */
export function generateSchemaRegistry() {
  const profiles = getAllProfiles();
  generateProfileSchemaRegistry(profiles);
}
