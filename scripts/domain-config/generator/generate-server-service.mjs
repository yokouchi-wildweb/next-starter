#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../../../src/utils/stringCase.mjs";
import { resolveFeaturePath, resolveFeatureTemplatePath } from "./utils/pathHelpers.mjs";

//
// サーバーサービス生成スクリプト
//
// 使い方:
//   node scripts/domain-generator/generate-server-service.mjs <Domain>
//
// <Domain> にはキャメルケースまたはパスカルケースでドメイン名を指定します。
// base.ts と <domain>Service.ts を src/features/<domain>/services/server/
// に作成します。

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
// --plural オプションがあればその値を取得
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

let dbEngineArg;
const dbIndex = args.findIndex((a) => a === "--dbEngine" || a === "-d");
// --dbEngine オプションがあれば使用するデータベース種別を取得
if (dbIndex !== -1) {
  dbEngineArg = args[dbIndex + 1];
}

// ドメイン名が指定されていない場合は使い方を表示して終了
if (!domain) {
  console.error("使い方: node scripts/domain-generator/generate-server-service.mjs <Domain>");
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const baseTemplateDir = resolveFeatureTemplatePath("services", "server");

const camelDir = resolveFeaturePath(camel);
const configPath = path.join(camelDir, "domain.json");
let dbEngine = "";
let serviceOptionsLiteral = "{}";
let relationImports = [];
if (fs.existsSync(configPath)) {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  dbEngine = cfg.dbEngine || "";
  const composed = composeServiceOptions(cfg);
  serviceOptionsLiteral = composed.optionsLiteral;
  relationImports = composed.relationTableImports;
}
// コマンドラインで指定された場合は設定より優先
if (dbEngineArg) dbEngine = dbEngineArg;

const templateDir = baseTemplateDir;
const outputDir = path.join(camelDir, "services", "server");
const wrapperDir = path.join(outputDir, "wrappers");

const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
const templates = [baseFile, "__domain__Service.ts"];

function collectBaseServiceOptions(config) {
  if (!config) return {};
  const options = {};
  if (config.idType) options.idType = config.idType;
  if (config.useCreatedAt) options.useCreatedAt = true;
  if (config.useUpdatedAt) options.useUpdatedAt = true;
  if (Array.isArray(config.searchFields) && config.searchFields.length) {
    options.defaultSearchFields = config.searchFields;
  }
  if (Array.isArray(config.defaultOrderBy) && config.defaultOrderBy.length) {
    options.defaultOrderBy = config.defaultOrderBy;
  }
  return options;
}

function composeServiceOptions(config) {
  const baseOptions = collectBaseServiceOptions(config);
  const belongsToMany = buildBelongsToManySnippets(config);
  const optionsLiteral = formatOptionsLiteral(baseOptions, belongsToMany);
  const relationTableImports = belongsToMany.map((item) => item.tableVar);
  return { optionsLiteral, relationTableImports };
}

function buildBelongsToManySnippets(config) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const relationTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
      const targetProperty = `${relationCamel}Id`;
      return {
        tableVar: relationTableVar,
        literal: [
          "{",
          `    fieldName: "${relation.fieldName}",`,
          `    throughTable: ${relationTableVar},`,
          `    sourceColumn: ${relationTableVar}.${sourceProperty},`,
          `    targetColumn: ${relationTableVar}.${targetProperty},`,
          `    sourceProperty: "${sourceProperty}",`,
          `    targetProperty: "${targetProperty}",`,
          "  }",
        ].join("\n"),
      };
    });
}

function formatOptionsLiteral(baseOptions, belongsToMany) {
  const entries = Object.entries(baseOptions).map(([key, value]) => {
    const formatted = JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
    return `  ${key}: ${formatted},`;
  });

  if (belongsToMany.length) {
    const literal = belongsToMany.map((item) => `  ${item.literal}`).join(",\n");
    entries.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  if (!entries.length) return "{}";
  return `{\n${entries.join("\n")}\n}`;
}

function buildEntityImports() {
  const imports = [`${pascal}Table`];
  relationImports.forEach((item) => {
    if (!imports.includes(item)) {
      imports.push(item);
    }
  });
  return imports.join(", ");
}

const drizzleEntityImports = buildEntityImports();

// テンプレート文字列内のトークンを置換
function replaceTokens(content) {
  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__serviceBase__/g, baseFile.replace(/\.ts$/, ""))
    .replace(/__serviceOptions__/g, serviceOptionsLiteral)
    .replace(/__DrizzleEntityImports__/g, drizzleEntityImports);
}

for (const file of templates) {
  const templatePath = path.join(templateDir, file);
  const outputFileName = replaceTokens(file);
  const outputFile = path.join(outputDir, outputFileName);

  // テンプレートファイルが無い場合はエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // wrappers ディレクトリが無ければ作成し .gitkeep を追加
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    const keepFile = path.join(wrapperDir, ".gitkeep");
    fs.writeFileSync(keepFile, "");
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template);

  fs.writeFileSync(outputFile, content);
  console.log(`サーバーサービスを生成しました: ${outputFile}`);
}
