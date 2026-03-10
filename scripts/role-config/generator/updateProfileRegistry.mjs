// scripts/role-config/generator/updateProfileRegistry.mjs
// src/registry/profileTableRegistry.ts と profileBaseRegistry.ts の全件再生成

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toPlural, toSnakeCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "src/registry");
const PROFILES_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/profiles"
);

/**
 * 全プロフィール設定を取得（JSON も読み込む）
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
      const configPath = path.join(PROFILES_DIR, file);
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return { roleId, config };
    });
}

/**
 * リレーション付きプロフィールかどうか
 */
function hasRelations(config) {
  return Array.isArray(config.relations) && config.relations.length > 0;
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

// ============================================================
// profileBaseRegistry.ts 生成 — リレーション対応
// ============================================================

/**
 * belongsToMany リレーション設定のリテラルを生成
 */
function buildBelongsToManyLiteral(roleId, rel) {
  const rolePascal = toPascalCase(roleId);
  const relationPascal = toPascalCase(rel.domain);
  const relationCamel = toCamelCase(rel.domain);
  const junctionTableVar = `${rolePascal}ProfileTo${relationPascal}Table`;
  const sourceProp = `${toCamelCase(roleId)}ProfileId`;
  const targetProp = `${relationCamel}Id`;

  return {
    junctionTableVar,
    relationDomain: relationCamel,
    relationTableVar: `${relationPascal}Table`,
    literal: [
      "      {",
      `        fieldName: "${rel.fieldName}",`,
      `        throughTable: ${junctionTableVar},`,
      `        sourceColumn: ${junctionTableVar}.${sourceProp},`,
      `        targetColumn: ${junctionTableVar}.${targetProp},`,
      `        sourceProperty: "${sourceProp}",`,
      `        targetProperty: "${targetProp}",`,
      "      }",
    ].join("\n"),
  };
}

/**
 * belongsTo リレーション設定のリテラルを生成
 */
function buildBelongsToLiteral(rel) {
  const relationPascal = toPascalCase(rel.domain);
  const field = toCamelCase(rel.fieldName).replace(/Id$/, "");

  return {
    relationDomain: toCamelCase(rel.domain),
    relationTableVar: `${relationPascal}Table`,
    literal: [
      "      {",
      `        field: "${field}",`,
      `        foreignKey: "${toCamelCase(rel.fieldName)}",`,
      `        table: ${relationPascal}Table,`,
      "      }",
    ].join("\n"),
  };
}

/**
 * belongsToMany オブジェクト展開設定のリテラルを生成
 */
function buildBelongsToManyObjectLiteral(roleId, rel) {
  const rolePascal = toPascalCase(roleId);
  const relationPascal = toPascalCase(rel.domain);
  const relationCamel = toCamelCase(rel.domain);
  const junctionTableVar = `${rolePascal}ProfileTo${relationPascal}Table`;
  const sourceProp = `${toCamelCase(roleId)}ProfileId`;
  const targetProp = `${relationCamel}Id`;
  const field = toPlural(rel.domain);

  return {
    junctionTableVar,
    relationDomain: relationCamel,
    relationTableVar: `${relationPascal}Table`,
    literal: [
      "      {",
      `        field: "${field}",`,
      `        targetTable: ${relationPascal}Table,`,
      `        throughTable: ${junctionTableVar},`,
      `        sourceColumn: ${junctionTableVar}.${sourceProp},`,
      `        targetColumn: ${junctionTableVar}.${targetProp},`,
      "      }",
    ].join("\n"),
  };
}

/**
 * countable リレーション設定のリテラルを生成
 */
function buildCountableLiteral(roleId, rel) {
  const rolePascal = toPascalCase(roleId);
  const relationPascal = toPascalCase(rel.domain);
  const junctionTableVar = `${rolePascal}ProfileTo${relationPascal}Table`;
  const sourceProp = `${toCamelCase(roleId)}ProfileId`;
  const field = toPlural(rel.domain);

  return {
    junctionTableVar,
    literal: [
      "      {",
      `        field: "${field}",`,
      `        throughTable: ${junctionTableVar},`,
      `        foreignKey: "${sourceProp}",`,
      "      }",
    ].join("\n"),
  };
}

/**
 * リレーション付きプロフィールの createProfileBase オプションリテラルを生成
 */
function buildRelationOptions(roleId, config) {
  const relations = config.relations || [];
  const belongsToRels = relations.filter((r) => r.relationType === "belongsTo");
  const m2mRels = relations.filter(
    (r) => r.relationType === "belongsToMany" && r.includeRelationTable !== false
  );

  // import する必要があるテーブル変数を収集
  const tableImports = new Map(); // domain → Set<tableVar>

  const optionParts = [];

  // defaultSearchFields
  optionParts.push(
    `      defaultSearchFields: (${roleId}Profile as ProfileConfig).searchFields,`
  );

  // belongsToManyRelations
  if (m2mRels.length > 0) {
    const items = m2mRels.map((rel) => {
      const item = buildBelongsToManyLiteral(roleId, rel);
      // import 追加
      const domain = item.relationDomain;
      if (!tableImports.has(domain)) tableImports.set(domain, new Set());
      tableImports.get(domain).add(item.relationTableVar);
      // 中間テーブルは生成ファイルから import
      return item;
    });
    optionParts.push(`      belongsToManyRelations: [\n${items.map((i) => i.literal).join(",\n")}\n      ],`);
  }

  // belongsToRelations
  if (belongsToRels.length > 0) {
    const items = belongsToRels.map((rel) => {
      const item = buildBelongsToLiteral(rel);
      const domain = item.relationDomain;
      if (!tableImports.has(domain)) tableImports.set(domain, new Set());
      tableImports.get(domain).add(item.relationTableVar);
      return item;
    });
    optionParts.push(`      belongsToRelations: [\n${items.map((i) => i.literal).join(",\n")}\n      ],`);
  }

  // belongsToManyObjectRelations
  if (m2mRels.length > 0) {
    const items = m2mRels.map((rel) => {
      const item = buildBelongsToManyObjectLiteral(roleId, rel);
      const domain = item.relationDomain;
      if (!tableImports.has(domain)) tableImports.set(domain, new Set());
      tableImports.get(domain).add(item.relationTableVar);
      return item;
    });
    optionParts.push(`      belongsToManyObjectRelations: [\n${items.map((i) => i.literal).join(",\n")}\n      ],`);
  }

  // countableRelations
  if (m2mRels.length > 0) {
    const items = m2mRels.map((rel) => buildCountableLiteral(roleId, rel));
    optionParts.push(`      countableRelations: [\n${items.map((i) => i.literal).join(",\n")}\n      ],`);
  }

  // 中間テーブルの import リスト
  const junctionTableVars = m2mRels.map((rel) => {
    const relationPascal = toPascalCase(rel.domain);
    return `${toPascalCase(roleId)}ProfileTo${relationPascal}Table`;
  });

  return { optionParts, tableImports, junctionTableVars };
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

  // プロフィールごとの import 文とエントリを生成
  const importLines = [];
  const entryLines = [];

  // リレーション先テーブルの import を収集（domain → Set<tableVar>）
  const allRelationTableImports = new Map();
  // 中間テーブルの import を収集（roleId → [tableVar]）
  const allJunctionImports = new Map();

  for (const { roleId, config } of profiles) {
    const tableVar = `${toPascalCase(roleId)}ProfileTable`;
    const profileVar = `${roleId}Profile`;

    // プロフィールテーブル + JSON の import
    importLines.push(
      `import { ${tableVar} } from "@/features/core/userProfile/generated/${roleId}";`
    );
    importLines.push(
      `import ${profileVar} from "@/features/core/userProfile/profiles/${roleId}.profile.json";`
    );

    if (hasRelations(config)) {
      const { optionParts, tableImports, junctionTableVars } = buildRelationOptions(roleId, config);

      // リレーション先テーブル import をマージ
      for (const [domain, vars] of tableImports) {
        if (!allRelationTableImports.has(domain)) {
          allRelationTableImports.set(domain, new Set());
        }
        for (const v of vars) {
          allRelationTableImports.get(domain).add(v);
        }
      }

      // 中間テーブル import
      if (junctionTableVars.length > 0) {
        allJunctionImports.set(roleId, junctionTableVars);
      }

      // エントリ（複数行オプション付き）
      entryLines.push(
        `  ${roleId}: createProfileBase(${tableVar}, {\n${optionParts.join("\n")}\n    }),`
      );
    } else {
      // リレーションなし（従来通り）
      entryLines.push(
        `  ${roleId}: createProfileBase(${tableVar}, { defaultSearchFields: (${profileVar} as ProfileConfig).searchFields }),`
      );
    }
  }

  // リレーション先テーブルの import 文
  const relationImportLines = [];
  for (const [domain, vars] of allRelationTableImports) {
    relationImportLines.push(
      `import { ${Array.from(vars).join(", ")} } from "@/features/${domain}/entities/drizzle";`
    );
  }

  // 中間テーブルの import 文（生成済みdrizzleから）
  const junctionImportLines = [];
  for (const [roleId, tableVars] of allJunctionImports) {
    junctionImportLines.push(
      `import { ${tableVars.join(", ")} } from "@/features/core/userProfile/generated/${roleId}/drizzle";`
    );
  }

  const extraImports = [...relationImportLines, ...junctionImportLines];
  const extraImportBlock = extraImports.length > 0 ? `\n${extraImports.join("\n")}` : "";

  const content = `// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました
//
// ヘルパー関数は @/features/core/userProfile/utils/profileBaseHelpers を使用してください

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

${importLines.join("\n")}${extraImportBlock}

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
${entryLines.join("\n")}
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
