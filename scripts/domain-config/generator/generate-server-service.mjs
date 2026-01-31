#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

function buildBelongsToManySnippets(config, pascal, camel) {
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
      const itemLines = item.literal.split("\n").map((line, lineIdx, arr) => {
        const trimmed = line.trimStart();
        const isFirstOrLast = lineIdx === 0 || lineIdx === arr.length - 1;
        const baseIndent = "          ";
        const indent = isFirstOrLast ? baseIndent : baseIndent + "  ";
        return indent + trimmed;
      });
      const suffix = idx < nestedBelongsTo.length - 1 ? "," : "";
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
 */
function buildBelongsToRelationsSnippets(config, pascal, camel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  const currentDomain = config.singular;
  visitedDomains.add(currentDomain);

  return config.relations
    .filter((relation) => relation.relationType === "belongsTo")
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const tableImport = `${relationPascal}Table`;
      const field = relation.fieldName.replace(/_id$/, "");

      let nestedLines = [];
      let nestedImports = { belongsTo: [], belongsToMany: [] };
      if (depth > 0 && !visitedDomains.has(relation.domain)) {
        const targetConfig = getDomainConfig(relationCamel);
        if (targetConfig && targetConfig.dbEngine === "Neon") {
          const nestedVisited = new Set(visitedDomains);
          const nestedBelongsTo = buildBelongsToRelationsSnippets(
            targetConfig,
            relationPascal,
            relationCamel,
            nestedVisited,
            0
          );
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
 */
function buildBelongsToManyObjectRelationsSnippets(config, ownerPascal, ownerCamel, visitedDomains = new Set(), depth = 1) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

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
      const field = toPlural(relation.domain.replace(/_/g, "_"));

      let nestedLines = [];
      let nestedImports = { belongsTo: [], belongsToMany: [] };
      if (depth > 0 && !visitedDomains.has(relation.domain)) {
        const targetConfig = getDomainConfig(relationCamel);
        if (targetConfig && targetConfig.dbEngine === "Neon") {
          const nestedVisited = new Set(visitedDomains);
          const nestedBelongsTo = buildBelongsToRelationsSnippets(
            targetConfig,
            relationPascal,
            relationCamel,
            nestedVisited,
            0
          );
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
        ownerDomain: toCamelCase(currentDomain),
        relationDomain: relation.domain,
        nestedImports,
        literal: lines.join("\n"),
      };
    });
}

/**
 * withCount 用: カウント取得対象のリレーション設定を生成
 */
function buildCountableRelationsSnippets(config, pascal, camel) {
  if (!Array.isArray(config.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const throughTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
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

  if (belongsToMany.length) {
    const literal = belongsToMany.map((item) => `  ${item.literal}`).join(",\n");
    entries.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  if (belongsToRelations.length) {
    const literal = belongsToRelations.map((item) => item.literal).join(",\n");
    entries.push(`  belongsToRelations: [\n${literal}\n  ],`);
  }

  if (belongsToManyObjectRelations.length) {
    const literal = belongsToManyObjectRelations.map((item) => item.literal).join(",\n");
    entries.push(`  belongsToManyObjectRelations: [\n${literal}\n  ],`);
  }

  if (countableRelations.length) {
    const literal = countableRelations.map((item) => item.literal).join(",\n");
    entries.push(`  countableRelations: [\n${literal}\n  ],`);
  }

  if (!entries.length) return "{}";
  return `{\n${entries.join("\n")}\n}`;
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

function formatAllRelationsLiteral(
  belongsToMany,
  belongsToRelations,
  belongsToManyObjectRelations,
  countableRelations
) {
  const sections = [];

  if (belongsToMany.length) {
    const literal = belongsToMany
      .map((item) => formatBelongsToManyBlock(item.lines))
      .join(",\n");
    sections.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  if (belongsToRelations.length) {
    const literal = belongsToRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToRelations: [\n${literal}\n  ],`);
  }

  if (belongsToManyObjectRelations.length) {
    const literal = belongsToManyObjectRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToManyObjectRelations: [\n${literal}\n  ],`);
  }

  if (countableRelations.length) {
    const literal = countableRelations.map((item) => item.literal).join(",\n");
    sections.push(`  countableRelations: [\n${literal}\n  ],`);
  }

  if (!sections.length) return "";
  return sections.join("\n") + "\n";
}

function composeServiceOptions(config, pascal, camel) {
  const baseOptions = collectBaseServiceOptions(config);
  const belongsToMany = buildBelongsToManySnippets(config, pascal, camel);
  const belongsToRelations = buildBelongsToRelationsSnippets(config, pascal, camel);
  const belongsToManyObjectRelations = buildBelongsToManyObjectRelationsSnippets(config, pascal, camel);
  const countableRelations = buildCountableRelationsSnippets(config, pascal, camel);

  const optionsLiteral = formatOptionsLiteral(
    baseOptions,
    belongsToMany,
    belongsToRelations,
    belongsToManyObjectRelations,
    countableRelations
  );

  const relationTableImports = [
    ...belongsToMany.map((item) => item.tableVar),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const relationDomainImports = [];

  function collectImports(items, type, isNested = false) {
    for (const item of items) {
      if (type === "belongsTo") {
        relationDomainImports.push({
          domain: item.relationDomain,
          tableImport: item.tableImport,
        });
      } else {
        relationDomainImports.push({
          domain: item.relationDomain,
          tableImport: item.targetTableImport,
        });
        if (isNested && item.throughTableVar && item.ownerDomain) {
          relationDomainImports.push({
            domain: item.ownerDomain,
            tableImport: item.throughTableVar,
          });
        }
      }

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

  const belongsToManyLiteral = formatAllRelationsLiteral(
    belongsToMany,
    belongsToRelations,
    belongsToManyObjectRelations,
    countableRelations
  );

  return { optionsLiteral, relationTableImports, belongsToManyLiteral, relationDomainImports };
}

function buildEntityImports(pascal, relationImports) {
  const imports = [`${pascal}Table`];
  relationImports.forEach((item) => {
    if (!imports.includes(item)) {
      imports.push(item);
    }
  });
  return imports.join(", ");
}

function buildRelationTableImports(relationDomainImports) {
  if (!relationDomainImports.length) return "";

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

  const lines = [];
  byDomain.forEach((imports, domainCamel) => {
    lines.push(`import { ${imports.join(", ")} } from "@/features/${domainCamel}/entities/drizzle";`);
  });

  return lines.length ? lines.join("\n") + "\n" : "";
}

/**
 * サーバーサービスを生成する
 * @param {string} domain - ドメイン名（snake_case, camelCase, PascalCase のいずれか）
 * @param {Object} options - オプション
 * @param {string} [options.plural] - 複数形（指定しない場合は自動生成）
 * @param {string} [options.dbEngine] - データベースエンジン（Neon or Firestore）
 * @param {Object} [options.targets] - 生成対象の指定（未指定時は全て生成）
 * @param {boolean} [options.targets.base] - drizzleBase.ts / firestoreBase.ts を生成
 * @param {boolean} [options.targets.service] - xxxService.ts を生成
 * @param {boolean} [options.targets.duplicateWrapper] - wrappers/duplicate.ts を生成
 * @param {boolean} [options.targets.removeWrapper] - wrappers/remove.ts を生成
 */
export default function generateServerService(domain, options = {}) {
  const { plural: pluralArg, dbEngine: dbEngineArg, targets } = options;

  // targets が指定されていない場合は全て生成
  const generateBase = targets?.base ?? true;
  const generateService = targets?.service ?? true;
  const generateDuplicateWrapper = targets?.duplicateWrapper ?? true;
  const generateRemoveWrapper = targets?.removeWrapper ?? true;

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
    const composed = composeServiceOptions(cfg, pascal, camel);
    serviceOptionsLiteral = composed.optionsLiteral;
    relationImports = composed.relationTableImports;
    belongsToManyLiteral = composed.belongsToManyLiteral;
    relationDomainImports = composed.relationDomainImports || [];
    hasMediaUploader = Array.isArray(cfg.fields) && cfg.fields.some((f) => f.fieldType === "mediaUploader");
  }

  if (dbEngineArg) dbEngine = dbEngineArg;

  const templateDir = baseTemplateDir;
  const outputDir = path.join(camelDir, "services", "server");
  const wrapperDir = path.join(outputDir, "wrappers");

  const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
  const serviceTemplate = hasMediaUploader ? "__domain__Service.withStorage.ts" : "__domain__Service.ts";

  // 生成対象のテンプレートを構築
  const templates = [];
  if (generateBase) templates.push(baseFile);
  if (generateService) templates.push(serviceTemplate);

  const drizzleEntityImports = buildEntityImports(pascal, relationImports);
  const relationTableImportsText = buildRelationTableImports(relationDomainImports);

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
    const outputFileName = file.includes("__domain__Service")
      ? replaceTokens("__domain__Service.ts")
      : replaceTokens(file);
    const outputFile = path.join(outputDir, outputFileName);

    if (!fs.existsSync(templatePath)) {
      console.error(`テンプレートが見つかりません: ${templatePath}`);
      return;
    }

    const template = fs.readFileSync(templatePath, "utf8");
    const content = replaceTokens(template);

    fs.writeFileSync(outputFile, content);
    console.log(`サーバーサービスを生成しました: ${outputFile}`);
  }

  // mediaUploaderがある場合はwrappersも生成（個別にフラグで制御）
  if (hasMediaUploader) {
    const wrapperTemplates = [];
    if (generateRemoveWrapper) wrapperTemplates.push("wrappers/remove.ts");
    if (generateDuplicateWrapper) wrapperTemplates.push("wrappers/duplicate.ts");

    for (const wrapperFile of wrapperTemplates) {
      const templatePath = path.join(templateDir, wrapperFile);
      const outputFile = path.join(outputDir, wrapperFile);

      if (!fs.existsSync(templatePath)) {
        console.error(`テンプレートが見つかりません: ${templatePath}`);
        return;
      }

      const template = fs.readFileSync(templatePath, "utf8");
      const content = replaceTokens(template);

      fs.writeFileSync(outputFile, content);
      console.log(`ラッパーを生成しました: ${outputFile}`);
    }

    // .gitkeep があれば削除（少なくとも1つのラッパーを生成した場合）
    if (wrapperTemplates.length > 0) {
      const keepFile = path.join(wrapperDir, ".gitkeep");
      if (fs.existsSync(keepFile)) {
        fs.unlinkSync(keepFile);
      }
    }
  }
}

// CLI実行時
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const domain = args[0];

  if (!domain) {
    console.error("使い方: node scripts/domain-config/generator/generate-server-service.mjs <Domain>");
    process.exit(1);
  }

  let pluralArg;
  const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
  if (pluralIndex !== -1) {
    pluralArg = args[pluralIndex + 1];
  }

  let dbEngineArg;
  const dbIndex = args.findIndex((a) => a === "--dbEngine" || a === "-d");
  if (dbIndex !== -1) {
    dbEngineArg = args[dbIndex + 1];
  }

  generateServerService(domain, { plural: pluralArg, dbEngine: dbEngineArg });
}
