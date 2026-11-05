// scripts/structure/role/generator/writeLists.mjs
// ロール・プロフィールの一覧（user/extensions/roles.ts・userProfile/extensions/profile*.ts）を丸ごと書く。
// 宣言: user・userProfile の extensionPoints.ts（writer: "role:generate"。extensions:generate は書かない）

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { toPlural } from "../../../domain-config/domain/plural.mjs";
import { AUDIT_LOGGER_IMPORT, auditLiteral, isAuditActive } from "../../../domain-config/spec/audit.mjs";
import { readProfileOverride, readRoleOverride, requireOverride } from "../overrides.mjs";
import { isCoreRole, roleFileOf } from "../rolePaths.mjs";
import { generatedHeader } from "./header.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../../..");
const EXTENSIONS_REL = "src/features/core/userProfile/extensions";
const EXTENSIONS_DIR = path.join(ROOT_DIR, EXTENSIONS_REL);
const ROLES_LIST_PATH = path.join(ROOT_DIR, "src/features/core/user/extensions/roles.ts");
const PROFILE_ENTITIES = "@/features/core/userProfile/entities/profiles";
const PROFILE_HEADER = generatedHeader("src/features/core/userProfile/extensionPoints.ts");
const PROFILES_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/profiles"
);

/** 一覧の要素の式: 上書きが無ければ JSON の変数のまま、あれば変数に上書きの値を重ねる */
const withOverride = (varName, override) => {
  const entries = Object.entries(override);
  return entries.length === 0 ? varName : `{ ...${varName}, ${entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} }`;
};

/**
 * 全プロフィール設定を取得（JSON も読み込む。config は上書き後、override は上書きだけ）
 */
function getAllProfiles() {
  if (!fs.existsSync(PROFILES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PROFILES_DIR);
  return files
    .filter((file) => file.endsWith(".profile.json"))
    .filter((file) => fs.existsSync(path.join(ROOT_DIR, "src/features/core/userProfile/entities/profiles", file.replace(".profile.json", ""))))
    .map((file) => {
      const roleId = file.replace(".profile.json", "");
      const configPath = path.join(PROFILES_DIR, file);
      const override = requireOverride(readProfileOverride(PROFILES_DIR, file));
      const config = { ...JSON.parse(fs.readFileSync(configPath, "utf8")), ...override };
      return { roleId, config, override };
    });
}

/**
 * リレーション付きプロフィールかどうか
 */
function hasRelations(config) {
  return Array.isArray(config.relations) && config.relations.length > 0;
}

/** userProfile/extensions/profileTables.ts: ロール → プロフィールテーブル（searchWithProfile 等が動的に参照する） */
function renderProfileTables(profiles) {
  const tableImports = profiles.map(({ roleId }) => {
    const tableVar = `${toPascalCase(roleId)}ProfileTable`;
    return `import { ${tableVar} } from "${PROFILE_ENTITIES}/${roleId}/drizzle";`;
  });
  const entries = profiles.map(({ roleId }) => `  ${roleId}: ${toPascalCase(roleId)}ProfileTable,`);
  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileTables.ts`,
    "",
    'import type { PgTable } from "drizzle-orm/pg-core";',
    "",
    ...tableImports,
    ...(tableImports.length ? [""] : []),
    "export const profileTables: Record<string, PgTable & Record<string, any>> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

/** userProfile/extensions/profileSchemas.ts: ロール → プロフィールの Zod スキーマ */
function renderProfileSchemas(profiles) {
  const imports = profiles.map(({ roleId }) => `import { ${toPascalCase(roleId)}ProfileSchema } from "${PROFILE_ENTITIES}/${roleId}";`);
  const entries = profiles.map(({ roleId }) => `  ${roleId}: ${toPascalCase(roleId)}ProfileSchema,`);
  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileSchemas.ts`,
    "",
    'import type { z } from "zod";',
    ...imports,
    "",
    "export const profileSchemas: Record<string, z.ZodType> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

/** userProfile/extensions/profileConfigs.ts: ロール → プロフィール設定 */
function renderProfileConfigs(profiles) {
  const imports = profiles.map(({ roleId }) => `import ${roleId}Profile from "@/features/core/userProfile/profiles/${roleId}.profile.json";`);
  const entries = profiles.map(({ roleId, override }) => `  ${roleId}: ${withOverride(`${roleId}Profile`, override)} as ProfileConfig,`);
  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileConfigs.ts`,
    "",
    'import type { ProfileConfig } from "@/features/core/userProfile/profiles";',
    ...imports,
    "",
    "export const profileConfigs: Record<string, ProfileConfig> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

// ============================================================
// profileBases.ts 生成 — リレーション対応
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

/** defaultSearchFields の式（上書きがあればその値、無ければ JSON） */
const searchFieldsExpression = (roleId, override) =>
  override.searchFields ? JSON.stringify(override.searchFields) : `(${roleId}Profile as ProfileConfig).searchFields`;

/**
 * リレーション付きプロフィールの createProfileBase オプションリテラルを生成
 */
function buildRelationOptions(roleId, config, override) {
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
    `      defaultSearchFields: ${searchFieldsExpression(roleId, override)},`
  );
  if (isAuditActive(config.audit)) optionParts.push(`      audit: ${auditLiteral(config.audit)},`);

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

/** userProfile/extensions/profileBases.ts: ロール → プロフィールベース（ヘルパーは userProfile/utils/profileBaseHelpers） */
function renderProfileBases(profiles) {
  // プロフィールごとの import 文とエントリを生成
  const importLines = [];
  const entryLines = [];

  // リレーション先テーブルの import を収集（domain → Set<tableVar>）
  const allRelationTableImports = new Map();
  // 中間テーブルの import を収集（roleId → [tableVar]）
  const allJunctionImports = new Map();

  for (const { roleId, config, override } of profiles) {
    const tableVar = `${toPascalCase(roleId)}ProfileTable`;
    const profileVar = `${roleId}Profile`;

    // プロフィールテーブル + JSON の import（searchFields を上書きしたら JSON は読まない）
    importLines.push(
      `import { ${tableVar} } from "${PROFILE_ENTITIES}/${roleId}";`
    );
    if (!override.searchFields) {
      importLines.push(
        `import ${profileVar} from "@/features/core/userProfile/profiles/${roleId}.profile.json";`
      );
    }

    if (hasRelations(config)) {
      const { optionParts, tableImports, junctionTableVars } = buildRelationOptions(roleId, config, override);

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
        `  ${roleId}: createProfileBase(${tableVar}, { defaultSearchFields: ${searchFieldsExpression(roleId, override)}${isAuditActive(config.audit) ? `, audit: ${auditLiteral(config.audit)}` : ""} }),`
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
      `import { ${tableVars.join(", ")} } from "${PROFILE_ENTITIES}/${roleId}/drizzle";`
    );
  }

  const extraImports = [...relationImportLines, ...junctionImportLines];
  const extraImportBlock = extraImports.length > 0 ? `\n${extraImports.join("\n")}` : "";

  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileBases.ts`,
    "",
    'import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";',
    'import type { ProfileBase } from "@/features/core/userProfile/types";',
    ...(profiles.some(({ config }) => isAuditActive(config.audit)) ? [AUDIT_LOGGER_IMPORT.trimEnd()] : []),
    ...(profiles.length ? ['import type { ProfileConfig } from "@/features/core/userProfile/profiles";', ""] : []),
    ...importLines,
    ...extraImports,
    "",
    "export const profileBases: Record<string, ProfileBase> = {",
    ...entryLines,
    "};",
    "",
  ].join("\n");
}

/** ロールの一覧のファイルにある並び（生成は 1 ロールずつ消して末尾に足す） */
function readRoleEntries() {
  if (!fs.existsSync(ROLES_LIST_PATH)) return [];
  const content = fs.readFileSync(ROLES_LIST_PATH, "utf8");
  return [...content.matchAll(/^import \w+Role from "@\/features\/core\/user\/(?:coreRoles|roles)\/([\w-]+)\.role\.json";$/gm)].map(([, id]) => ({ id }));
}

/** 一覧のファイルの ID の並び（generate --all が使う） */
export const registeredRoleIds = () => readRoleEntries().map((entry) => entry.id);

function writeRoles(entries) {
  const varOf = ({ id }) => `${toCamelCase(id)}Role`;
  const overrideOf = ({ id }) => requireOverride(readRoleOverride(roleFileOf(id)));
  const content = [
    generatedHeader("src/features/core/user/extensionPoints.ts"),
    "// src/features/core/user/extensions/roles.ts",
    "",
    'import type { RoleConfig } from "@/features/core/user/types";',
    "",
    ...entries.map((e) => `import ${varOf(e)} from "@/features/core/user/${isCoreRole(e.id) ? "coreRoles" : "roles"}/${e.id}.role.json";`),
    "",
    "export const roles: readonly RoleConfig[] = [",
    ...entries.map((e) => `  ${withOverride(varOf(e), overrideOf(e))} as RoleConfig,`),
    "];",
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(ROLES_LIST_PATH), { recursive: true });
  fs.writeFileSync(ROLES_LIST_PATH, content);
}

/** ロールの一覧の末尾に足す（同じ ID があれば先に外す） */
export function addRoleToList(roleConfig) {
  writeRoles([...readRoleEntries().filter((e) => e.id !== roleConfig.id), { id: roleConfig.id }]);
}

/** ロールの一覧から外す。外したら true */
export function removeRoleFromList(roleId) {
  const entries = readRoleEntries();
  const kept = entries.filter((e) => e.id !== roleId);
  if (kept.length === entries.length) return false;
  writeRoles(kept);
  return true;
}

/** プロフィールの一覧 4 本を丸ごと書く（プロフィール設定と生成フォルダの両方があるものだけ） */
export function writeProfileLists() {
  const profiles = getAllProfiles();
  fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  const write = (name, content) => fs.writeFileSync(path.join(EXTENSIONS_DIR, `${name}.ts`), content);
  write("profileTables", renderProfileTables(profiles));
  write("profileSchemas", renderProfileSchemas(profiles));
  write("profileConfigs", renderProfileConfigs(profiles));
  write("profileBases", renderProfileBases(profiles));
}
