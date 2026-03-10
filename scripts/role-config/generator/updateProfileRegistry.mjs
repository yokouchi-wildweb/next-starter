// scripts/role-config/generator/updateProfileRegistry.mjs
// src/registry/profileTableRegistry.ts と profileBaseRegistry.ts の全件再生成

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
 * profileTableRegistry.ts を全件再生成
 */
function generateProfileTableRegistry(profiles) {
  const header = `// src/registry/profileTableRegistry.ts
// プロフィールテーブル定義の re-export + テーブルマップ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました`;

  if (profiles.length === 0) {
    const content = `${header}
`;
    fs.writeFileSync(path.join(REGISTRY_DIR, "profileTableRegistry.ts"), content);
    return;
  }

  // re-export
  const exports = profiles
    .map(({ roleId }) => [
      `export * from "@/features/core/userProfile/generated/${roleId}/drizzle";`,
      `export * from "@/features/core/userProfile/generated/${roleId}";`,
    ])
    .flat()
    .join("\n");

  // PROFILE_TABLE_MAP 用の import
  const tableImports = profiles
    .map(({ roleId }) => {
      const tableVar = `${toPascalCase(roleId)}ProfileTable`;
      return `import { ${tableVar} } from "@/features/core/userProfile/generated/${roleId}/drizzle";`;
    })
    .join("\n");

  // PROFILE_TABLE_MAP のエントリ
  const tableEntries = profiles
    .map(({ roleId }) => {
      const tableVar = `${toPascalCase(roleId)}ProfileTable`;
      return `  ${roleId}: ${tableVar},`;
    })
    .join("\n");

  const content = `${header}

import type { PgTable } from "drizzle-orm/pg-core";

${exports}

${tableImports}

/**
 * ロール → プロフィールテーブルのマッピング
 * searchWithProfile 等でプロフィールテーブルを動的に参照するために使用
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROFILE_TABLE_MAP: Record<string, PgTable & Record<string, any>> = {
${tableEntries}
};
`;

  fs.writeFileSync(path.join(REGISTRY_DIR, "profileTableRegistry.ts"), content);
}

/**
 * profileBaseRegistry.ts を全件再生成
 */
function generateProfileBaseRegistry(profiles) {
  if (profiles.length === 0) {
    const content = `// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました
//
// ヘルパー関数は @/features/core/userProfile/utils/profileBaseHelpers を使用してください

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {};
`;
    fs.writeFileSync(path.join(REGISTRY_DIR, "profileBaseRegistry.ts"), content);
    return;
  }

  // import 文を生成
  const imports = profiles
    .map(({ roleId }) => {
      const tableVar = `${toPascalCase(roleId)}ProfileTable`;
      return [
        `import { ${tableVar} } from "@/features/core/userProfile/generated/${roleId}";`,
        `import ${roleId}Profile from "@/features/core/userProfile/profiles/${roleId}.profile.json";`,
      ].join("\n");
    })
    .join("\n");

  // レジストリエントリを生成
  const entries = profiles
    .map(({ roleId }) => {
      const tableVar = `${toPascalCase(roleId)}ProfileTable`;
      const profileVar = `${roleId}Profile`;
      return `  ${roleId}: createProfileBase(${tableVar}, { defaultSearchFields: (${profileVar} as ProfileConfig).searchFields }),`;
    })
    .join("\n");

  const content = `// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました
//
// ヘルパー関数は @/features/core/userProfile/utils/profileBaseHelpers を使用してください

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

${imports}

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
${entries}
};
`;

  fs.writeFileSync(path.join(REGISTRY_DIR, "profileBaseRegistry.ts"), content);
}

/**
 * プロフィールレジストリを全件再生成
 */
export function updateProfileRegistry() {
  const profiles = getAllProfiles();
  generateProfileTableRegistry(profiles);
  generateProfileBaseRegistry(profiles);
}
