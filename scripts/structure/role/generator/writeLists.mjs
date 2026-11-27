// scripts/structure/role/generator/writeLists.mjs
// ロール・プロフィールの一覧（user/extensions/roles.ts・userProfile/extensions/profile*.ts）を丸ごと書く。
// 宣言: user・userProfile の extensionPoints.ts（writer: "role:generate"。pnpm generate extensions は書かない）

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";
import { toPlural } from "../../domain/domain/plural.mjs";
import { AUDIT_LOGGER_IMPORT, auditLiteral, isAuditActive } from "../../domain/spec/audit.mjs";
import { readProfileOverride, readRoleOverride, requireOverride } from "../overrides.mjs";
import { isCoreRole, roleFileOf } from "../rolePaths.mjs";
import { assertNoProfileJunction } from "./generateProfileDrizzle.mjs";
import { generatedHeader } from "./header.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../../..");
const EXTENSIONS_REL = "src/domains/core/userProfile/extensions";
const EXTENSIONS_DIR = path.join(ROOT_DIR, EXTENSIONS_REL);
const ROLES_LIST_PATH = path.join(ROOT_DIR, "src/domains/core/user/extensions/roles.ts");
const PROFILE_ENTITIES = "@/domains/core/userProfile/entities/profiles";
const PROFILE_HEADER = generatedHeader("src/domains/core/userProfile/extensionPoints.ts");
const PROFILES_DIR = path.join(
  ROOT_DIR,
  "src/domains/core/userProfile/profiles"
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
    .filter((file) => fs.existsSync(path.join(ROOT_DIR, "src/domains/core/userProfile/entities/profiles", file.replace(".profile.json", ""))))
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
  const imports = profiles.map(({ roleId }) => `import ${roleId}Profile from "@/domains/core/userProfile/profiles/${roleId}.profile.json";`);
  const entries = profiles.map(({ roleId, override }) => `  ${roleId}: ${withOverride(`${roleId}Profile`, override)} as ProfileConfig,`);
  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileConfigs.ts`,
    "",
    'import type { ProfileConfig } from "@/domains/core/userProfile/profiles";',
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



/** defaultSearchFields の式（上書きがあればその値、無ければ JSON） */
const searchFieldsExpression = (roleId, override) =>
  override.searchFields ? JSON.stringify(override.searchFields) : `(${roleId}Profile as ProfileConfig).searchFields`;

/**
 * リレーション付きプロフィールの createProfileBase オプションリテラルを生成
 */
function buildRelationOptions(roleId, config, override) {
  const relations = config.relations || [];
  const belongsToRels = relations.filter((r) => r.relationType === "belongsTo");
  // 多対多はまだ書けない(generateProfileDrizzle.mjs の PROFILE_JUNCTION_STOP)
  assertNoProfileJunction(relations);

  // import する必要があるテーブル変数を収集
  const tableImports = new Map(); // domain → Set<tableVar>

  const optionParts = [];

  // defaultSearchFields
  optionParts.push(
    `      defaultSearchFields: ${searchFieldsExpression(roleId, override)},`
  );
  if (isAuditActive(config.audit)) optionParts.push(`      audit: ${auditLiteral(config.audit)},`);

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

  return { optionParts, tableImports };
}

/** userProfile/extensions/profileBases.ts: ロール → プロフィールベース（ヘルパーは userProfile/utils/profileBaseHelpers） */
function renderProfileBases(profiles) {
  // プロフィールごとの import 文とエントリを生成
  const importLines = [];
  const entryLines = [];

  // リレーション先テーブルの import を収集（domain → Set<tableVar>）
  const allRelationTableImports = new Map();
  // 中間テーブルの import を収集（roleId → [tableVar]）

  for (const { roleId, config, override } of profiles) {
    const tableVar = `${toPascalCase(roleId)}ProfileTable`;
    const profileVar = `${roleId}Profile`;

    // プロフィールテーブル + JSON の import（searchFields を上書きしたら JSON は読まない）
    importLines.push(
      `import { ${tableVar} } from "${PROFILE_ENTITIES}/${roleId}";`
    );
    if (!override.searchFields) {
      importLines.push(
        `import ${profileVar} from "@/domains/core/userProfile/profiles/${roleId}.profile.json";`
      );
    }

    if (hasRelations(config)) {
      const { optionParts, tableImports } = buildRelationOptions(roleId, config, override);

      // リレーション先テーブル import をマージ
      for (const [domain, vars] of tableImports) {
        if (!allRelationTableImports.has(domain)) {
          allRelationTableImports.set(domain, new Set());
        }
        for (const v of vars) {
          allRelationTableImports.get(domain).add(v);
        }
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
      `import { ${Array.from(vars).join(", ")} } from "@/domains/${domain}/entities/drizzle";`
    );
  }

  const extraImports = relationImportLines;
  const extraImportBlock = extraImports.length > 0 ? `\n${extraImports.join("\n")}` : "";

  return [
    PROFILE_HEADER,
    `// ${EXTENSIONS_REL}/profileBases.ts`,
    "",
    'import { createProfileBase } from "@/domains/core/userProfile/utils/createProfileBase";',
    'import type { ProfileBase } from "@/domains/core/userProfile/types";',
    ...(profiles.some(({ config }) => isAuditActive(config.audit)) ? [AUDIT_LOGGER_IMPORT.trimEnd()] : []),
    ...(profiles.length ? ['import type { ProfileConfig } from "@/domains/core/userProfile/profiles";', ""] : []),
    ...importLines,
    ...extraImports,
    "",
    "export const profileBases: Record<string, ProfileBase> = {",
    ...entryLines,
    "};",
    "",
  ].join("\n");
}

/** ロールの一覧のファイルにある並び（= pg enum user_role の値の並び。今あるロールは動かさず、新しい ID だけ末尾に足す） */
function readRoleEntries() {
  if (!fs.existsSync(ROLES_LIST_PATH)) return [];
  const content = fs.readFileSync(ROLES_LIST_PATH, "utf8");
  return [...content.matchAll(/^import \w+Role from "@\/domains\/core\/user\/(?:coreRoles|roles)\/([\w-]+)\.role\.json";$/gm)].map(([, id]) => ({ id }));
}

/** 一覧のファイルの ID の並び(並び方の入力の 1 つ。roleOrder.mjs) */
export const registeredRoleIds = () => readRoleEntries().map((entry) => entry.id);

function writeRoles(entries) {
  const varOf = ({ id }) => `${toCamelCase(id)}Role`;
  const overrideOf = ({ id }) => requireOverride(readRoleOverride(roleFileOf(id)));
  const content = [
    generatedHeader("src/domains/core/user/extensionPoints.ts"),
    "// src/domains/core/user/extensions/roles.ts",
    "",
    'import type { RoleConfig } from "@/domains/core/user/types";',
    "",
    ...entries.map((e) => `import ${varOf(e)} from "@/domains/core/user/${isCoreRole(e.id) ? "coreRoles" : "roles"}/${e.id}.role.json";`),
    "",
    "export const roles: readonly RoleConfig[] = [",
    ...entries.map((e) => `  ${withOverride(varOf(e), overrideOf(e))} as RoleConfig,`),
    "];",
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(ROLES_LIST_PATH), { recursive: true });
  fs.writeFileSync(ROLES_LIST_PATH, content);
}

/**
 * 一覧をこの並びで書く(並びは roleOrder.mjs の orderRoles が決める: 設定の roleOrder → 今の一覧 → 末尾)。
 * 一覧の並びは DB の enum の並び: 今ある値を動かすと drizzle-kit が DROP TYPE と列の書き直しを出す(足すだけなら ADD VALUE)
 */
export function writeRoleList(roleIds) {
  writeRoles(roleIds.map((id) => ({ id })));
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
