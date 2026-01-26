#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../../../src/utils/stringCase.mjs";
import { resolveFeaturePath, resolveFeatureTemplatePath, resolveFeaturesDir } from "./utils/pathHelpers.mjs";

// ドメインの設定を取得
function getDomainConfig(domainPath) {
  const featuresDir = resolveFeaturesDir();
  const configPath = path.join(featuresDir, domainPath, "domain.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  return null;
}

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
let belongsToManyLiteral = "";
let relationDomainImports = [];
let hasMediaUploader = false;
if (fs.existsSync(configPath)) {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  dbEngine = cfg.dbEngine || "";
  const composed = composeServiceOptions(cfg);
  serviceOptionsLiteral = composed.optionsLiteral;
  relationImports = composed.relationTableImports;
  belongsToManyLiteral = composed.belongsToManyLiteral;
  relationDomainImports = composed.relationDomainImports || [];
  // mediaUploaderフィールドの有無を判定
  hasMediaUploader = Array.isArray(cfg.fields) && cfg.fields.some((f) => f.fieldType === "mediaUploader");
}
// コマンドラインで指定された場合は設定より優先
if (dbEngineArg) dbEngine = dbEngineArg;

const templateDir = baseTemplateDir;
const outputDir = path.join(camelDir, "services", "server");
const wrapperDir = path.join(outputDir, "wrappers");

const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
// mediaUploaderがある場合はストレージ連携版のサービステンプレートを使用
const serviceTemplate = hasMediaUploader ? "__domain__Service.withStorage.ts" : "__domain__Service.ts";
const templates = [baseFile, serviceTemplate];

function collectBaseServiceOptions(config) {
  if (!config) return {};
  const options = {};
  if (config.idType) options.idType = config.idType;
  if (config.useCreatedAt) options.useCreatedAt = true;
  if (config.useUpdatedAt) options.useUpdatedAt = true;
  if (config.useSoftDelete) options.useSoftDelete = true;
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

  // withRelations / withCount 用の設定を構築
  const belongsToRelations = buildBelongsToRelationsSnippets(config);
  const belongsToManyObjectRelations = buildBelongsToManyObjectRelationsSnippets(config);
  const countableRelations = buildCountableRelationsSnippets(config);

  const optionsLiteral = formatOptionsLiteral(
    baseOptions,
    belongsToMany,
    belongsToRelations,
    belongsToManyObjectRelations,
    countableRelations
  );

  // 関連テーブルのインポートを収集
  // throughテーブル（SampleToSampleTagTable等）はドメイン内のdrizzleからインポート
  // 対象テーブル（SampleCategoryTable等）は各ドメインから別途インポート
  const relationTableImports = [
    ...belongsToMany.map((item) => item.tableVar),
  ].filter((v, i, a) => a.indexOf(v) === i); // 重複除去

  // リレーション先ドメインのインポート情報を収集（nested対応）
  const relationDomainImports = [];

  // 再帰的にインポートを収集するヘルパー
  function collectImports(items, type, isNested = false) {
    for (const item of items) {
      if (type === "belongsTo") {
        relationDomainImports.push({
          domain: item.relationDomain,
          tableImport: item.tableImport,
        });
      } else {
        // targetTable のインポート
        relationDomainImports.push({
          domain: item.relationDomain,
          tableImport: item.targetTableImport,
        });
        // nested の場合は throughTable もインポートが必要（ownerDomainから）
        if (isNested && item.throughTableVar && item.ownerDomain) {
          relationDomainImports.push({
            domain: item.ownerDomain,
            tableImport: item.throughTableVar,
          });
        }
      }

      // nestedImportsがあれば再帰的に収集
      if (item.nestedImports) {
        if (item.nestedImports.belongsTo?.length > 0) {
          collectImports(item.nestedImports.belongsTo, "belongsTo", true);
        }
        if (item.nestedImports.belongsToMany?.length > 0) {
          collectImports(item.nestedImports.belongsToMany, "belongsToMany", true);
        }
      }
    }
  }

  collectImports(belongsToRelations, "belongsTo");
  collectImports(belongsToManyObjectRelations, "belongsToMany");

  // すべてのリレーション設定をまとめたリテラルを生成
  const belongsToManyLiteral = formatAllRelationsLiteral(
    belongsToMany,
    belongsToRelations,
    belongsToManyObjectRelations,
    countableRelations
  );

  return { optionsLiteral, relationTableImports, belongsToManyLiteral, relationDomainImports };
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
        lines: [
          "{",
          `fieldName: "${relation.fieldName}",`,
          `throughTable: ${relationTableVar},`,
          `sourceColumn: ${relationTableVar}.${sourceProperty},`,
          `targetColumn: ${relationTableVar}.${targetProperty},`,
          `sourceProperty: "${sourceProperty}",`,
          `targetProperty: "${targetProperty}",`,
          "}",
        ],
      };
    });
}

/**
 * nested リテラルの行を構築
 */
function buildNestedLiteralLines(nestedBelongsTo, nestedBelongsToMany) {
  const lines = ["      nested: {"];

  if (nestedBelongsTo.length > 0) {
    lines.push("        belongsTo: [");
    nestedBelongsTo.forEach((item, idx) => {
      // 各行を適切にインデント
      const itemLines = item.literal.split("\n").map((line, lineIdx, arr) => {
        const trimmed = line.trimStart();
        // 開き括弧と閉じ括弧はベースインデント、プロパティ行は+2スペース
        const isFirstOrLast = lineIdx === 0 || lineIdx === arr.length - 1;
        const baseIndent = "          ";
        const indent = isFirstOrLast ? baseIndent : baseIndent + "  ";
        return indent + trimmed;
      });
      const suffix = idx < nestedBelongsTo.length - 1 ? "," : "";
      // 最後の行に suffix を追加
      itemLines[itemLines.length - 1] += suffix;
      lines.push(...itemLines);
    });
    lines.push("        ],");
  }

  if (nestedBelongsToMany.length > 0) {
    lines.push("        belongsToMany: [");
    nestedBelongsToMany.forEach((item, idx) => {
      const itemLines = item.literal.split("\n").map((line, lineIdx, arr) => {
        const trimmed = line.trimStart();
        const isFirstOrLast = lineIdx === 0 || lineIdx === arr.length - 1;
        const baseIndent = "          ";
        const indent = isFirstOrLast ? baseIndent : baseIndent + "  ";
        return indent + trimmed;
      });
      const suffix = idx < nestedBelongsToMany.length - 1 ? "," : "";
      itemLines[itemLines.length - 1] += suffix;
      lines.push(...itemLines);
    });
    lines.push("        ],");
  }

  lines.push("      },");
  return lines;
}

/**
 * withRelations 用: belongsTo リレーション設定を生成（2階層nested対応）
 * @param config - ドメイン設定
 * @param visitedDomains - 訪問済みドメイン（循環参照防止）
 * @param depth - 残り展開階層（1=nestedを生成、0=nestedを生成しない）
 */
function buildBelongsToRelationsSnippets(config, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  // 現在のドメインを訪問済みに追加（循環参照防止）
  const currentDomain = config.singular;
  visitedDomains.add(currentDomain);

  return config.relations
    .filter((relation) => relation.relationType === "belongsTo")
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const tableImport = `${relationPascal}Table`;
      // field名: sample_category_id → sample_category
      const field = relation.fieldName.replace(/_id$/, "");

      // リレーション先のconfigを取得してnested構築（循環参照がなく、depth > 0 の場合のみ）
      let nestedLines = [];
      let nestedImports = { belongsTo: [], belongsToMany: [] };
      if (depth > 0 && !visitedDomains.has(relation.domain)) {
        const targetConfig = getDomainConfig(relationCamel);
        if (targetConfig && targetConfig.dbEngine === "Neon") {
          const nestedVisited = new Set(visitedDomains);
          // 再帰呼び出しではdepth=0でnestedを生成しない
          const nestedBelongsTo = buildBelongsToRelationsSnippets(targetConfig, nestedVisited, 0);
          const nestedBelongsToMany = buildBelongsToManyObjectRelationsSnippets(
            targetConfig,
            relationPascal,
            relationCamel,
            nestedVisited,
            0
          );

          if (nestedBelongsTo.length > 0 || nestedBelongsToMany.length > 0) {
            nestedLines = buildNestedLiteralLines(nestedBelongsTo, nestedBelongsToMany);
            nestedImports = {
              belongsTo: nestedBelongsTo,
              belongsToMany: nestedBelongsToMany,
            };
          }
        }
      }

      const lines = [
        "    {",
        `      field: "${field}",`,
        `      foreignKey: "${relation.fieldName}",`,
        `      table: ${tableImport},`,
      ];
      if (nestedLines.length > 0) {
        lines.push(...nestedLines);
      }
      lines.push("    }");

      return {
        tableImport,
        relationDomain: relation.domain,
        nestedImports,
        literal: lines.join("\n"),
      };
    });
}

/**
 * withRelations 用: belongsToMany のオブジェクト展開設定を生成（2階層nested対応）
 * @param config - ドメイン設定
 * @param ownerPascal - 所有者ドメインのPascalCase
 * @param ownerCamel - 所有者ドメインのcamelCase
 * @param visitedDomains - 訪問済みドメイン（循環参照防止）
 * @param depth - 残り展開階層（1=nestedを生成、0=nestedを生成しない）
 */
function buildBelongsToManyObjectRelationsSnippets(config, ownerPascal = pascal, ownerCamel = camel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  // 現在のドメインを訪問済みに追加（循環参照防止）
  const currentDomain = config.singular;
  visitedDomains.add(currentDomain);

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const targetTableImport = `${relationPascal}Table`;
      const throughTableVar = `${ownerPascal}To${relationPascal}Table`;
      const sourceProperty = `${ownerCamel}Id`;
      const targetProperty = `${relationCamel}Id`;
      // field名: sample_tag_ids → sample_tags (複数形)
      const field = toPlural(relation.domain.replace(/_/g, "_"));

      // リレーション先のconfigを取得してnested構築（循環参照がなく、depth > 0 の場合のみ）
      let nestedLines = [];
      let nestedImports = { belongsTo: [], belongsToMany: [] };
      if (depth > 0 && !visitedDomains.has(relation.domain)) {
        const targetConfig = getDomainConfig(relationCamel);
        if (targetConfig && targetConfig.dbEngine === "Neon") {
          const nestedVisited = new Set(visitedDomains);
          // 再帰呼び出しではdepth=0でnestedを生成しない
          const nestedBelongsTo = buildBelongsToRelationsSnippets(targetConfig, nestedVisited, 0);
          const nestedBelongsToMany = buildBelongsToManyObjectRelationsSnippets(
            targetConfig,
            relationPascal,
            relationCamel,
            nestedVisited,
            0
          );

          if (nestedBelongsTo.length > 0 || nestedBelongsToMany.length > 0) {
            nestedLines = buildNestedLiteralLines(nestedBelongsTo, nestedBelongsToMany);
            nestedImports = {
              belongsTo: nestedBelongsTo,
              belongsToMany: nestedBelongsToMany,
            };
          }
        }
      }

      const lines = [
        "    {",
        `      field: "${field}",`,
        `      targetTable: ${targetTableImport},`,
        `      throughTable: ${throughTableVar},`,
        `      sourceColumn: ${throughTableVar}.${sourceProperty},`,
        `      targetColumn: ${throughTableVar}.${targetProperty},`,
      ];
      if (nestedLines.length > 0) {
        lines.push(...nestedLines);
      }
      lines.push("    }");

      return {
        targetTableImport,
        throughTableVar,
        ownerDomain: toCamelCase(currentDomain), // throughTableのインポート元ドメイン
        relationDomain: relation.domain,
        nestedImports,
        literal: lines.join("\n"),
      };
    });
}

/**
 * withCount 用: カウント取得対象のリレーション設定を生成
 */
function buildCountableRelationsSnippets(config) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const throughTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
      // field名: sample_tag_ids → sample_tags (複数形)
      const field = toPlural(relation.domain.replace(/_/g, "_"));
      return {
        literal: [
          "    {",
          `      field: "${field}",`,
          `      throughTable: ${throughTableVar},`,
          `      foreignKey: "${sourceProperty}",`,
          "    }",
        ].join("\n"),
      };
    });
}

function formatOptionsLiteral(
  baseOptions,
  belongsToMany,
  belongsToRelations = [],
  belongsToManyObjectRelations = [],
  countableRelations = []
) {
  const entries = Object.entries(baseOptions).map(([key, value]) => {
    const formatted = JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
    return `  ${key}: ${formatted},`;
  });

  // 既存: belongsToMany の ID配列 hydrate 用
  if (belongsToMany.length) {
    const literal = belongsToMany.map((item) => `  ${item.literal}`).join(",\n");
    entries.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsTo リレーション設定
  if (belongsToRelations.length) {
    const literal = belongsToRelations.map((item) => item.literal).join(",\n");
    entries.push(`  belongsToRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsToMany のオブジェクト展開設定
  if (belongsToManyObjectRelations.length) {
    const literal = belongsToManyObjectRelations.map((item) => item.literal).join(",\n");
    entries.push(`  belongsToManyObjectRelations: [\n${literal}\n  ],`);
  }

  // withCount 用: カウント取得対象のリレーション設定
  if (countableRelations.length) {
    const literal = countableRelations.map((item) => item.literal).join(",\n");
    entries.push(`  countableRelations: [\n${literal}\n  ],`);
  }

  if (!entries.length) return "{}";
  return `{\n${entries.join("\n")}\n}`;
}

function formatBelongsToManyLiteral(belongsToMany) {
  if (!belongsToMany.length) return "";
  const literal = belongsToMany
    .map((item) => formatBelongsToManyBlock(item.lines))
    .join(",\n");
  return `  belongsToManyRelations: [\n${literal}\n  ],\n`;
}

/**
 * すべてのリレーション設定をまとめたリテラルを生成
 * テンプレートの __belongsToManyRelations__ トークンに挿入される
 */
function formatAllRelationsLiteral(
  belongsToMany,
  belongsToRelations,
  belongsToManyObjectRelations,
  countableRelations
) {
  const sections = [];

  // 既存: belongsToMany の ID配列 hydrate 用
  if (belongsToMany.length) {
    const literal = belongsToMany
      .map((item) => formatBelongsToManyBlock(item.lines))
      .join(",\n");
    sections.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsTo リレーション設定
  if (belongsToRelations.length) {
    const literal = belongsToRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsToMany のオブジェクト展開設定
  if (belongsToManyObjectRelations.length) {
    const literal = belongsToManyObjectRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToManyObjectRelations: [\n${literal}\n  ],`);
  }

  // withCount 用: カウント取得対象のリレーション設定
  if (countableRelations.length) {
    const literal = countableRelations.map((item) => item.literal).join(",\n");
    sections.push(`  countableRelations: [\n${literal}\n  ],`);
  }

  if (!sections.length) return "";
  return sections.join("\n") + "\n";
}

function formatBelongsToManyBlock(lines = []) {
  return lines
    .map((line, index) => {
      const isEdge = index === 0 || index === lines.length - 1;
      const indent = isEdge ? "    " : "      ";
      return `${indent}${line}`;
    })
    .join("\n");
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

/**
 * リレーション先テーブルのインポート文を生成
 * 例: import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
 */
function buildRelationTableImports() {
  if (!relationDomainImports.length) return "";

  // ドメインごとにグループ化
  const byDomain = new Map();
  relationDomainImports.forEach(({ domain, tableImport }) => {
    const domainCamel = toCamelCase(domain);
    if (!byDomain.has(domainCamel)) {
      byDomain.set(domainCamel, []);
    }
    const imports = byDomain.get(domainCamel);
    if (!imports.includes(tableImport)) {
      imports.push(tableImport);
    }
  });

  // インポート文を生成
  const lines = [];
  byDomain.forEach((imports, domainCamel) => {
    lines.push(`import { ${imports.join(", ")} } from "@/features/${domainCamel}/entities/drizzle";`);
  });

  // インポート文がある場合は末尾に改行を追加（テンプレートの次の行と接続するため）
  return lines.length ? lines.join("\n") + "\n" : "";
}

const drizzleEntityImports = buildEntityImports();
const relationTableImportsText = buildRelationTableImports();

// テンプレート文字列内のトークンを置換
function replaceTokens(content) {
  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__serviceBase__/g, baseFile.replace(/\.ts$/, ""))
    .replace(/__serviceOptions__/g, serviceOptionsLiteral)
    .replace(/__DrizzleEntityImports__/g, drizzleEntityImports)
    .replace(/__belongsToManyRelations__/g, belongsToManyLiteral)
    .replace(/__RelationTableImports__/g, relationTableImportsText);
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

for (const file of templates) {
  const templatePath = path.join(templateDir, file);
  // サービステンプレートの出力ファイル名は常に __domain__Service.ts にする
  const outputFileName = file.includes("__domain__Service")
    ? replaceTokens("__domain__Service.ts")
    : replaceTokens(file);
  const outputFile = path.join(outputDir, outputFileName);

  // テンプレートファイルが無い場合はエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template);

  fs.writeFileSync(outputFile, content);
  console.log(`サーバーサービスを生成しました: ${outputFile}`);
}

// mediaUploaderがある場合はwrappersも生成
if (hasMediaUploader) {
  const wrapperTemplates = ["wrappers/remove.ts", "wrappers/duplicate.ts"];
  for (const wrapperFile of wrapperTemplates) {
    const templatePath = path.join(templateDir, wrapperFile);
    const outputFile = path.join(outputDir, wrapperFile);

    if (!fs.existsSync(templatePath)) {
      console.error(`テンプレートが見つかりません: ${templatePath}`);
      process.exit(1);
    }

    const template = fs.readFileSync(templatePath, "utf8");
    const content = replaceTokens(template);

    fs.writeFileSync(outputFile, content);
    console.log(`ラッパーを生成しました: ${outputFile}`);
  }

  // .gitkeep があれば削除
  const keepFile = path.join(wrapperDir, ".gitkeep");
  if (fs.existsSync(keepFile)) {
    fs.unlinkSync(keepFile);
  }
}
